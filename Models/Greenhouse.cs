namespace FarmManagement.API.Models
{
    public class Greenhouse
    {
        public int Id { get; set; }

        public string GreenhouseName { get; set; } = string.Empty;

        public string GreenhouseType { get; set; } = string.Empty;

        public decimal Area { get; set; }

        public string AreaUnit { get; set; } = "m²";

        public string Location { get; set; } = string.Empty;

        public string Status { get; set; } = "active";

        public int FarmId { get; set; }

        public Farm? Farm { get; set; }

        public ICollection<Zone> Zones { get; set; } = new List<Zone>();
    }
}
