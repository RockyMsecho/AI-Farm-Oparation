namespace FarmManagement.API.Common
{
    /// <summary>
    /// Every permission your API checks. This replaces `[Authorize(Roles =
    /// "Owner,Manager")]` scattered across controllers with
    /// `[Authorize(Policy = Permissions.ZonesCreate)]`.
    ///
    /// The difference matters once you have more than a handful of roles: with
    /// role-string checks, adding a new role ("Supervisor", say) means
    /// re-reading every controller to see which `Authorize(Roles = ...)`
    /// lists need it added. With permissions, you add one row to the seed
    /// matrix in RbacSeeder and every endpoint that checks "zones.view"
    /// automatically respects it - no controller code changes.
    ///
    /// Naming convention: "resource.action", lowercase. Keep it flat - you
    /// don't need a hierarchy for a project this size.
    /// </summary>
    public static class Permissions
    {
        public const string RolesPermissionsManage = "roles.permissions.manage";

        public const string UsersView = "users.view";
        public const string UsersCreate = "users.create";
        public const string UsersUpdateRole = "users.updateRole";
        public const string UsersUpdateStatus = "users.updateStatus";

        public const string FarmsCreate = "farms.create";
        public const string FarmsView = "farms.view";

        public const string GreenhousesCreate = "greenhouses.create";
        public const string GreenhousesView = "greenhouses.view";

        public const string ZonesCreate = "zones.create";
        public const string ZonesView = "zones.view";
        public const string ZonesUpdate = "zones.update";
        public const string ZonesDelete = "zones.delete";

        public const string ShiftsManage = "shifts.manage";
        public const string ShiftsViewTeam = "shifts.viewTeam";

        public const string ReportsCreate = "reports.create";
        public const string ReportsView = "reports.view";
        public const string ReportsRecommend = "reports.recommend";
        public const string ReportsApprove = "reports.approve";

        public const string OperationsView = "operations.view";
        public const string CropManage = "crops.manage";
        public const string LivestockManage = "livestock.manage";
        public const string InventoryManage = "inventory.manage";
        public const string TasksManage = "tasks.manage";

        /// <summary>
        /// Every permission that exists. The seeder inserts one Permission row
        /// per entry here - add a new permission by adding it here, nowhere
        /// else.
        /// </summary>
        public static readonly string[] All =
        {
            RolesPermissionsManage, UsersView, UsersCreate, UsersUpdateRole, UsersUpdateStatus,
            FarmsCreate, FarmsView,
            GreenhousesCreate, GreenhousesView,
            ZonesCreate, ZonesView, ZonesUpdate, ZonesDelete,
            ShiftsManage, ShiftsViewTeam,
            ReportsCreate, ReportsView, ReportsRecommend, ReportsApprove,
            OperationsView, CropManage, LivestockManage, InventoryManage, TasksManage
        };
    }
}
