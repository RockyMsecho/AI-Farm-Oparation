namespace FarmManagement.API.Models;
public class CropVariety { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Crop { get; set; } = ""; public string Variety { get; set; } = ""; public string Notes { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
