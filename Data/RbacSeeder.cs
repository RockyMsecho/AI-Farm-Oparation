using FarmManagement.API.Common;
using FarmManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Data
{
    /// <summary>
    /// Creates the Role and Permission rows and links them, matching the
    /// behaviour your project had before this change (Owner could do
    /// everything, Manager could do everything except delete a zone, staff
    /// could view but not create/edit/delete).
    ///
    /// Safe to run on every startup - it only inserts what's missing, so it
    /// won't duplicate rows or wipe permissions you've since changed by hand
    /// in the database, except where a role's row here says it should have a
    /// permission it currently lacks (that link gets added, never removed).
    /// If you want to revoke a permission from a role permanently, do it here
    /// so the next deploy doesn't re-add it.
    /// </summary>
    public static class RbacSeeder
    {
        private static readonly Dictionary<string, string[]> RolePermissions = new()
        {
            [Roles.Owner] = Permissions.All, // everything, including role/permission management

            [Roles.Manager] = new[]
            {
                Permissions.UsersView, Permissions.UsersCreate,
                Permissions.UsersUpdateRole, Permissions.UsersUpdateStatus,
                Permissions.FarmsCreate, Permissions.FarmsView,
                Permissions.GreenhousesCreate, Permissions.GreenhousesView,
                Permissions.ZonesCreate, Permissions.ZonesView, Permissions.ZonesUpdate,
                Permissions.ShiftsManage, Permissions.ShiftsViewTeam,
                Permissions.ReportsView, Permissions.ReportsRecommend, Permissions.ReportsApprove,
                Permissions.OperationsView, Permissions.CropManage, Permissions.LivestockManage, Permissions.InventoryManage, Permissions.TasksManage
            },

            [Roles.Worker] = new[]
            {
                Permissions.FarmsView, Permissions.GreenhousesView, Permissions.ZonesView, Permissions.OperationsView,
                Permissions.ShiftsManage, Permissions.ReportsCreate
            },

            [Roles.Agronomist] = new[]
            {
                Permissions.FarmsView, Permissions.GreenhousesView, Permissions.ZonesView,
                Permissions.ShiftsManage,
                Permissions.ReportsView, Permissions.ReportsRecommend, Permissions.OperationsView, Permissions.CropManage
            },

            [Roles.Technician] = new[]
            {
                Permissions.FarmsView, Permissions.GreenhousesView, Permissions.ZonesView, Permissions.OperationsView,
                Permissions.ShiftsManage, Permissions.ReportsCreate
            }
        };

        public static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct = default)
        {
            var existingPermissions = await context.Permissions.ToDictionaryAsync(p => p.Name, ct);

            foreach (var name in Permissions.All)
            {
                if (!existingPermissions.ContainsKey(name))
                {
                    var permission = new Permission { Name = name };
                    context.Permissions.Add(permission);
                    existingPermissions[name] = permission;
                }
            }

            await context.SaveChangesAsync(ct);

            var existingRoles = await context.Roles
                .Include(r => r.Permissions)
                .ToDictionaryAsync(r => r.Name, ct);

            foreach (var roleName in Roles.All)
            {
                if (!existingRoles.ContainsKey(roleName))
                {
                    var role = new Role { Name = roleName };
                    context.Roles.Add(role);
                    existingRoles[roleName] = role;
                }
            }

            await context.SaveChangesAsync(ct);

            foreach (var (roleName, permissionNames) in RolePermissions)
            {
                var role = existingRoles[roleName];
                var alreadyLinked = role.Permissions.Select(p => p.Name).ToHashSet();

                foreach (var permissionName in permissionNames)
                {
                    if (!alreadyLinked.Contains(permissionName))
                        role.Permissions.Add(existingPermissions[permissionName]);
                }
            }

            await context.SaveChangesAsync(ct);
        }
    }
}
