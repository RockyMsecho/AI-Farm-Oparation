using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Controllers
{
    /// <summary>
    /// Owner-only management of the Role -> Permission matrix.
    /// The existing RolePermissions table is the source of truth; this
    /// controller does not create a second permissions system.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = Permissions.RolesPermissionsManage)]
    public class RolesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RolesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetRoles(CancellationToken ct)
        {
            var roles = await _context.Roles
                .AsNoTracking()
                .Include(r => r.Permissions)
                .OrderBy(r => r.Id)
                .Select(r => new
                {
                    id = r.Id,
                    name = r.Name,
                    permissions = r.Permissions
                        .OrderBy(p => p.Name)
                        .Select(p => p.Name)
                        .ToList()
                })
                .ToListAsync(ct);

            return Ok(roles);
        }

        [HttpGet("permissions")]
        public async Task<IActionResult> GetPermissions(CancellationToken ct)
        {
            var permissions = await _context.Permissions
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    description = p.Description
                })
                .ToListAsync(ct);

            return Ok(permissions);
        }

        [HttpPut("{id:int}/permissions")]
        public async Task<IActionResult> UpdatePermissions(
            int id,
            [FromBody] UpdateRolePermissionsRequest request,
            CancellationToken ct)
        {
            if (request?.Permissions is null)
                return BadRequest(new { message = "Permissions are required." });

            var role = await _context.Roles
                .Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.Id == id, ct);

            if (role is null)
                return NotFound(new { message = "Role not found." });

            if (role.Name == Roles.Owner)
            {
                return BadRequest(new
                {
                    message = "The Owner role always has full access and cannot have its permissions changed."
                });
            }

            var requested = request.Permissions
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            var allPermissions = await _context.Permissions.ToListAsync(ct);
            var knownNames = allPermissions
                .Select(p => p.Name)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var unknown = requested.Where(p => !knownNames.Contains(p)).ToArray();
            if (unknown.Length > 0)
            {
                return BadRequest(new
                {
                    message = "One or more permissions do not exist.",
                    unknownPermissions = unknown
                });
            }

            var selected = allPermissions
                .Where(p => requested.Contains(p.Name, StringComparer.OrdinalIgnoreCase))
                .ToList();

            role.Permissions.Clear();
            foreach (var permission in selected)
                role.Permissions.Add(permission);

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = $"Permissions for {role.Name} updated successfully.",
                role = role.Name,
                permissions = role.Permissions.Select(p => p.Name).OrderBy(n => n).ToArray(),
                requiresRelogin = true
            });
        }
    }

    public sealed class UpdateRolePermissionsRequest
    {
        public string[] Permissions { get; set; } = Array.Empty<string>();
    }
}
