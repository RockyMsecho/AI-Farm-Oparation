namespace FarmManagement.API.Models
{
    public class User
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string Phone { get; set; } = string.Empty;

        public string PasswordHash { get; set; } = string.Empty;

        public string? PasswordResetTokenHash { get; set; }
        public DateTime? PasswordResetTokenExpiresUtc { get; set; }

        public int RoleId { get; set; }
        public Role? Role { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;

        public int? FarmId { get; set; }
        public Farm? Farm { get; set; }

        public Farm? OwnedFarm { get; set; }
    }
}
