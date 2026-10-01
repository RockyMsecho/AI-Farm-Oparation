namespace FarmManagement.API.Models;
public class OperatingCost { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public DateTime Date { get; set; } public string Category { get; set; } = "Other"; public string Description { get; set; } = ""; public decimal Amount { get; set; } }
