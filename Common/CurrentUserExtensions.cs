using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FarmManagement.API.Data;
using FarmManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Common
{
    public static class CurrentUserExtensions
    {
        public static int? GetUserId(this ClaimsPrincipal principal)
        {
            var claim = principal.FindFirst(JwtRegisteredClaimNames.Sub)
                        ?? principal.FindFirst(ClaimTypes.NameIdentifier);

            if (claim is null || !int.TryParse(claim.Value, out int id))
                return null;

            return id;
        }

        /// <summary>
        /// Always includes Role now. Permission checks on endpoints read the
        /// JWT's claims and never touch this method - but a handful of
        /// business rules (a Manager can't promote another user to Manager;
        /// the Owner role can't be reassigned) need the actual role *name*,
        /// not just "does this user have permission X". Those checks read
        /// currentUser.Role!.Name / targetUser.Role!.Name, so the navigation
        /// has to be loaded.
        /// </summary>
        public static async Task<User?> GetCurrentUserAsync(
            this ClaimsPrincipal principal,
            ApplicationDbContext context,
            CancellationToken ct = default)
        {
            var id = principal.GetUserId();
            if (id is null) return null;

            return await context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == id.Value && u.IsActive, ct);
        }
    }
}
