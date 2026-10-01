namespace FarmManagement.API.Models;
public class InventoryItem { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Item { get; set; } = ""; public string Category { get; set; } = ""; public decimal Quantity { get; set; } public string Unit { get; set; } = ""; public decimal Reorder { get; set; } }
