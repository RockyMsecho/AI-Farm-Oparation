using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.DTOs;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Hosting;
using FarmManagement.API.Services;

namespace FarmManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;
        private readonly IEmailSender _emailSender;

        public AuthController(IConfiguration configuration, ApplicationDbContext context, IEmailSender emailSender)
        {
            _configuration = configuration;
            _context = context;
            _emailSender = emailSender;
        }


        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Register(
            [FromBody] RegisterDto request,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.FullName) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Mobile) ||
                string.IsNullOrWhiteSpace(request.Password) ||
                string.IsNullOrWhiteSpace(request.ConfirmPassword) ||
                string.IsNullOrWhiteSpace(request.FarmName) ||
                string.IsNullOrWhiteSpace(request.FarmLocation) ||
                string.IsNullOrWhiteSpace(request.FarmType) ||
                string.IsNullOrWhiteSpace(request.AreaUnit) ||
                string.IsNullOrWhiteSpace(request.PrimaryCrop))
            {
                return BadRequest(new { message = "Please complete all required fields." });
            }

            if (request.Password != request.ConfirmPassword)
                return BadRequest(new { message = "Passwords do not match." });

            if (request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            if (request.FarmArea <= 0)
                return BadRequest(new { message = "Farm area must be greater than 0." });

            var email = request.Email.Trim().ToLowerInvariant();

            if (await _context.Users.AnyAsync(u => u.Email == email, ct))
            {
                return BadRequest(new
                {
                    message = "An account with this email already exists. Please login instead."
                });
            }

            var ownerRole = await _context.Roles
                .FirstOrDefaultAsync(r => r.Name == Roles.Owner, ct);

            if (ownerRole is null)
            {
                return StatusCode(500, new { message = "Roles are not configured. Contact the administrator." });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(ct);

            try
            {
                var user = new User
                {
                    Name = request.FullName.Trim(),
                    Email = email,
                    Phone = request.Mobile.Trim(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    RoleId = ownerRole.Id,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync(ct); // assigns user.Id

                var farm = new Farm
                {
                    FarmName = request.FarmName.Trim(),
                    FarmLocation = request.FarmLocation.Trim(),
                    FarmType = request.FarmType.Trim(),
                    FarmArea = request.FarmArea,
                    AreaUnit = request.AreaUnit,
                    PrimaryCrop = request.PrimaryCrop.Trim(),
                    OwnerId = user.Id
                };

                _context.Farms.Add(farm);
                await _context.SaveChangesAsync(ct);

                user.FarmId = farm.Id;
                await _context.SaveChangesAsync(ct);

                await transaction.CommitAsync(ct);

                return Ok(new
                {
                    message = "Registration successful.",
                    userId = user.Id,
                    farmId = farm.Id,
                    name = user.Name,
                    email = user.Email,
                    phone = user.Phone,
                    role = ownerRole.Name,
                    farmName = farm.FarmName
                });
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        }


        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request, CancellationToken ct)
        {
            var user = await FindForLoginAsync(request.Email, ct);

            var check = ValidateLogin(user, request.Password);
            if (check is not null) return check;

            return Ok(await BuildLoginResponseAsync(user!));
        }


        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword(
            [FromBody] ForgotPasswordRequestDto request,
            CancellationToken ct)
        {
            const string genericMessage =
                "If an account exists for that email, a password reset link has been sent.";

            if (request is null || string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { message = "Email is required." });

            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

            if (user is null || !user.IsActive)
                return Ok(new { message = genericMessage });

            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace("+", "-").Replace("/", "_").TrimEnd('=');
            var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

            user.PasswordResetTokenHash = tokenHash;
            user.PasswordResetTokenExpiresUtc = DateTime.UtcNow.AddMinutes(30);
            await _context.SaveChangesAsync(ct);

            var frontendOrigin = _configuration["PasswordReset:FrontendOrigin"]
                ?? $"{Request.Scheme}://{Request.Host}";
            var resetLink = $"{frontendOrigin.TrimEnd('/')}/auth.html#reset={Uri.EscapeDataString(rawToken)}";

            var smtpConfigured =
                !string.IsNullOrWhiteSpace(_configuration["Email:SmtpHost"]) &&
                !string.IsNullOrWhiteSpace(_configuration["Email:Username"]) &&
                !string.IsNullOrWhiteSpace(_configuration["Email:Password"]) &&
                !string.IsNullOrWhiteSpace(_configuration["Email:From"]);

            if (smtpConfigured)
            {
                var html = $"""
                    <p>Hello {System.Net.WebUtility.HtmlEncode(user.Name)},</p>
                    <p>We received a request to reset your AI FARM password.</p>
                    <p><a href="{System.Net.WebUtility.HtmlEncode(resetLink)}">Reset your password</a></p>
                    <p>This link expires in 30 minutes and can only be used once.</p>
                    <p>If you did not request this, you can ignore this email.</p>
                    """;

                await _emailSender.SendAsync(
                    user.Email,
                    "AI FARM password reset",
                    html,
                    ct);
            }
            else if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == Environments.Development)
            {
                return Ok(new
                {
                    message = genericMessage,
                    developmentResetLink = resetLink
                });
            }
            else
            {
                return Ok(new { message = genericMessage });
            }

            return Ok(new { message = genericMessage });
        }


        [HttpPost("reset-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResetPassword(
            [FromBody] ResetPasswordRequestDto request,
            CancellationToken ct)
        {
            if (request is null || string.IsNullOrWhiteSpace(request.Token))
                return BadRequest(new { message = "Reset token is required." });

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            if (request.NewPassword != request.ConfirmPassword)
                return BadRequest(new { message = "Passwords do not match." });

            var tokenHash = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(request.Token)));

            var user = await _context.Users
                .FirstOrDefaultAsync(u =>
                    u.PasswordResetTokenHash == tokenHash &&
                    u.PasswordResetTokenExpiresUtc != null &&
                    u.PasswordResetTokenExpiresUtc > DateTime.UtcNow,
                    ct);

            if (user is null)
                return BadRequest(new { message = "This password reset link is invalid or has expired." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordResetTokenHash = null;
            user.PasswordResetTokenExpiresUtc = null;

            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Password reset successfully. You can now sign in." });
        }


        [HttpPut("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequestDto request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new { message = "Current and new password are required." });

            if (request.NewPassword.Length < 8)
                return BadRequest(new { message = "New password must be at least 8 characters." });

            if (request.NewPassword != request.ConfirmNewPassword)
                return BadRequest(new { message = "New passwords do not match." });

            var userId = User.GetUserId();
            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
            if (user is null)
                return NotFound(new { message = "User not found." });

            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                return BadRequest(new { message = "Current password is incorrect." });

            if (BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
                return BadRequest(new { message = "New password must be different from the current password." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordResetTokenHash = null;
            user.PasswordResetTokenExpiresUtc = null;
            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Password updated successfully." });
        }


        /// <summary>
        /// Role and its Permissions must be loaded here - GenerateJwtToken
        /// needs both, and lazy loading isn't configured, so leaving out
        /// either Include silently produces a token with no permission claims
        /// at all instead of an exception you'd notice.
        /// </summary>
        private Task<User?> FindForLoginAsync(string email, CancellationToken ct) =>
            _context.Users
                .Include(u => u.Role)
                .ThenInclude(r => r!.Permissions)
                .FirstOrDefaultAsync(u => u.Email == email.Trim().ToLowerInvariant(), ct);

        /// <summary>
        /// Returns null if the login should proceed, or the IActionResult to
        /// return if it should stop.
        /// </summary>
        private IActionResult? ValidateLogin(User? user, string password)
        {
            if (user is null)
                return Unauthorized(new { message = "Invalid email or password." });

            if (!user.IsActive)
                return Unauthorized(new { message = "Your account is inactive. Please contact the administrator." });

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return Unauthorized(new { message = "Invalid email or password." });

            if (user.Role is null)
                return StatusCode(500, new { message = "This account has no role assigned. Contact the administrator." });

            return null;
        }

        private Task<object> BuildLoginResponseAsync(User user)
        {
            var token = GenerateJwtToken(user);

            return Task.FromResult<object>(new
            {
                token,
                userId = user.Id,
                username = user.Name,
                email = user.Email,
                role = user.Role!.Name,
                farmId = user.FarmId
            });
        }

        /// <summary>
        /// user.Role and user.Role.Permissions must already be loaded -
        /// FindForLoginAsync guarantees this. One "permission" claim per
        /// permission the user's role has; PermissionAuthorizationHandler
        /// reads these directly, so no database call happens per request.
        /// </summary>
        private string GenerateJwtToken(User user)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(ClaimTypes.Role, user.Role!.Name)
            };

            claims.AddRange(user.Role.Permissions.Select(p => new Claim("permission", p.Name)));

            var jwtKey = _configuration["Jwt:Key"];

            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException("JWT Key is missing from appsettings.json.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(1),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
