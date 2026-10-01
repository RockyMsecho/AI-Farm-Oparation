namespace FarmManagement.API.Models;
public class LivestockProduction { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Batch { get; set; } = ""; public string Metric { get; set; } = ""; public string Value { get; set; } = ""; public DateTime Date { get; set; } }
