namespace FarmManagement.API.Models
{
    /// <summary>
    /// Replaces the free-text `User.Role` string. A real row means the
    /// database can enforce that `User.RoleId` points at something that
    /// actually exists - the string version let you type "Ownre" and nothing
    /// would ever tell you.
    /// </summary>
    public class Role
    {
        public int Id { get; set; }

        /// <summary>
        /// "Owner", "Manager", "Worker", "Agronomist", "Technician" - see
        /// Common/Roles.cs for the constants. A few business rules still care
        /// about the actual role name (a Manager can't promote another user to
        /// Manager, for instance) - that's identity, not permissions, and
        /// permissions can't express it. Everything else should check a
        /// permission, not this name.
        /// </summary>
        public string Name { get; set; } = string.Empty;

        public ICollection<Permission> Permissions { get; set; } = new List<Permission>();
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
