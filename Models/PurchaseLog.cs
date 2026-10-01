namespace FarmManagement.API.Models;
public class PurchaseLog { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Type { get; set; } = "Request"; public string Text { get; set; } = ""; public string Who { get; set; } = ""; public string Status { get; set; } = "Pending"; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
