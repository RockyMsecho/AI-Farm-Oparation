namespace FarmManagement.API.Models;
public class HarvestRecord { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Crop { get; set; } = ""; public string Field { get; set; } = ""; public DateTime Date { get; set; } public decimal Quantity { get; set; } public string Unit { get; set; } = "kg"; }
