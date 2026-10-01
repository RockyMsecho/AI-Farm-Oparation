namespace FarmManagement.API.Models;
public class LivestockHealthRecord { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Batch { get; set; } = ""; public string Text { get; set; } = ""; public string Who { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
