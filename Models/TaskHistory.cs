namespace FarmManagement.API.Models;
public class TaskHistory
{
    public int Id { get; set; }
    public int FarmId { get; set; }
    public Farm? Farm { get; set; }
    public int FarmTaskId { get; set; }
    public FarmTask? FarmTask { get; set; }
    public string Action { get; set; } = "Created";
    public string Status { get; set; } = "Pending";
    public string ChangedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
