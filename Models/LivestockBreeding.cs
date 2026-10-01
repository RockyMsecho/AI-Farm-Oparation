namespace FarmManagement.API.Models;
public class LivestockBreeding { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Batch { get; set; } = ""; public string Event { get; set; } = "Mating"; public DateTime Date { get; set; } public string Notes { get; set; } = ""; }
