using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.DTOs;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Controllers
{
    /// <summary>
    /// Endpoint gating now checks permissions ([Authorize(Policy = ...)])
    /// instead of role names ([Authorize(Roles = "Owner,Manager")]). The
    /// business rules that are genuinely about role *identity* - a Manager
    /// can't promote another Manager, the Owner role can't be reassigned -
    /// stay as explicit checks against currentUser.Role!.Name, because no
    /// permission can express "not this specific role".
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UserController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Policy = Permissions.UsersView)]
        public async Task<IActionResult> GetUsers(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var users = await _context.Users
                .AsNoTracking()
                .Where(u => u.FarmId == currentUser.FarmId)
                .OrderBy(u => u.Name)
                .Select(u => new
                {
                    id = u.Id,
                    name = u.Name,
                    email = u.Email,
                    phone = u.Phone,
                    role = u.Role!.Name,
                    isActive = u.IsActive,
                    createdAt = u.CreatedAt,
                    farmId = u.FarmId
                })
                .ToListAsync(ct);

            return Ok(users);
        }

        [HttpPost]
        [Authorize(Policy = Permissions.UsersCreate)]
        public async Task<IActionResult> CreateUser(CreateUserRequestDto request, CancellationToken ct)
        {
            if (request is null)
                return BadRequest(new { message = "User information is required." });

            if (string.IsNullOrWhiteSpace(request.FullName))
                return BadRequest(new { message = "Full name is required." });

            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { message = "Email is required." });

            if (string.IsNullOrWhiteSpace(request.Mobile))
                return BadRequest(new { message = "Mobile number is required." });

            if (string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Password is required." });

            if (request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            if (request.Password != request.ConfirmPassword)
                return BadRequest(new { message = "Passwords do not match." });

            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var requestedRole = request.Role.Trim();
            string[] assignableRoles = currentUser.Role?.Name switch
            {
                Roles.Owner => new[] { Roles.Manager, Roles.Agronomist, Roles.Technician, Roles.Worker },
                Roles.Manager => Roles.Staff,
                _ => Array.Empty<string>()
            };

            if (!assignableRoles.Contains(requestedRole, StringComparer.OrdinalIgnoreCase))
            {
                return Forbid();
            }

            requestedRole = assignableRoles.First(r =>
                string.Equals(r, requestedRole, StringComparison.OrdinalIgnoreCase));

            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == requestedRole, ct);
            if (role is null)
                return BadRequest(new { message = "That role does not exist." });

            var email = request.Email.Trim().ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email == email, ct))
                return BadRequest(new { message = "An account with this email already exists." });

            var newUser = new User
            {
                Name = request.FullName.Trim(),
                Email = email,
                Phone = request.Mobile.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                RoleId = role.Id,
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
                FarmId = currentUser.FarmId
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "User created successfully.",
                userId = newUser.Id,
                name = newUser.Name,
                email = newUser.Email,
                phone = newUser.Phone,
                role = role.Name,
                farmId = newUser.FarmId,
                isActive = newUser.IsActive
            });
        }

        [HttpPut("{id:int}/role")]
        [Authorize(Policy = Permissions.UsersUpdateRole)]
        public async Task<IActionResult> UpdateUserRole(
            int id,
            [FromBody] UpdateUserRoleRequestDto request,
            CancellationToken ct)
        {
            if (request is null || string.IsNullOrWhiteSpace(request.Role))
                return BadRequest(new { message = "Role is required." });

            var newRoleName = request.Role.Trim();

            var assignableRoleNames = new[]
            {
                Roles.Manager, Roles.Worker, Roles.Agronomist, Roles.Technician
            };

            if (!assignableRoleNames.Contains(newRoleName))
            {
                return BadRequest(new
                {
                    message = "Invalid role. Allowed roles are Manager, Worker, Agronomist, and Technician."
                });
            }

            var newRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == newRoleName, ct);
            if (newRole is null)
                return BadRequest(new { message = "That role does not exist." });

            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var targetUser = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == id && u.FarmId == currentUser.FarmId, ct);

            if (targetUser is null)
                return NotFound(new { message = "User not found in your farm." });

            if (targetUser.Id == currentUser.Id)
                return BadRequest(new { message = "You cannot change your own role." });

            if (targetUser.Role!.Name == Roles.Owner)
                return BadRequest(new { message = "The Owner role cannot be changed." });

            if (currentUser.Role!.Name == Roles.Manager)
            {
                if (targetUser.Role.Name == Roles.Manager || newRoleName == Roles.Manager)
                    return Forbid();
            }

            var previousRole = targetUser.Role.Name;

            targetUser.RoleId = newRole.Id;

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "User role updated successfully.",
                userId = targetUser.Id,
                name = targetUser.Name,
                email = targetUser.Email,
                previousRole,
                role = newRole.Name,
                farmId = targetUser.FarmId
            });
        }

        [HttpPut("{id:int}/status")]
        [Authorize(Policy = Permissions.UsersUpdateStatus)]
        public async Task<IActionResult> UpdateUserStatus(
            int id,
            [FromBody] UpdateUserStatusRequestDto request,
            CancellationToken ct)
        {
            if (request is null)
                return BadRequest(new { message = "Status is required." });

            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null || !currentUser.FarmId.HasValue)
                return Unauthorized(new { message = "Management user or farm could not be found." });

            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == id && u.FarmId == currentUser.FarmId, ct);

            if (user is null)
                return NotFound(new { message = "User not found in your farm." });

            if (user.Id == currentUser.Id && !request.IsActive)
                return BadRequest(new { message = "You cannot deactivate your own account." });

            if (user.Role!.Name == Roles.Owner && !request.IsActive)
                return BadRequest(new { message = "The Owner account cannot be deactivated." });

            user.IsActive = request.IsActive;

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = request.IsActive ? "User activated successfully." : "User deactivated successfully.",
                userId = user.Id,
                name = user.Name,
                role = user.Role.Name,
                isActive = user.IsActive
            });
        }
    }
}
