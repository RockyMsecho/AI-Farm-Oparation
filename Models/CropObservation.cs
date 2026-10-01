namespace FarmManagement.API.Models;
public class CropObservation { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Field { get; set; } = ""; public string Text { get; set; } = ""; public string Severity { get; set; } = "ok"; public string Who { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
