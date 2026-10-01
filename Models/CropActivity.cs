namespace FarmManagement.API.Models;
public class CropActivity { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Type { get; set; } = "Other"; public string Text { get; set; } = ""; public string Who { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
