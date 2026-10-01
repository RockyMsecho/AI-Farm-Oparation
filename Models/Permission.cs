namespace FarmManagement.API.Models
{
    public class Permission
    {
        public int Id { get; set; }

        /// <summary>e.g. "zones.delete" - matches a constant in Common/Permissions.cs.</summary>
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public ICollection<Role> Roles { get; set; } = new List<Role>();
    }
}
