namespace FarmManagement.API.Models;
public class Supplier { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Name { get; set; } = ""; public string Contact { get; set; } = ""; public string Category { get; set; } = ""; }
