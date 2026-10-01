namespace FarmManagement.API.Models;
public class LivestockLog { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Type { get; set; } = "Feed"; public string Text { get; set; } = ""; public string Who { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
