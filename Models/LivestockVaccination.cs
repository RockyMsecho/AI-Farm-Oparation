namespace FarmManagement.API.Models;
public class LivestockVaccination { public int Id { get; set; } public int FarmId { get; set; } public Farm? Farm { get; set; } public string Batch { get; set; } = ""; public string Vaccine { get; set; } = ""; public DateTime Due { get; set; } public string Status { get; set; } = "Scheduled"; }
