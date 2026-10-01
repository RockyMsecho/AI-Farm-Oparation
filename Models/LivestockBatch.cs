namespace FarmManagement.API.Models;
public class LivestockBatch { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Name { get; set; } = ""; public string Size { get; set; } = ""; public string Purpose { get; set; } = ""; public string Stage { get; set; } = ""; public string Status { get; set; } = "ok"; }
