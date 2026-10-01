namespace FarmManagement.API.DTOs
{
    public class ZoneDto
    {
        public string ZoneName { get; set; } = string.Empty;

        public string ZoneType { get; set; } = string.Empty;

        public decimal Area { get; set; }

        public string AreaUnit { get; set; } = "m²";

        public string Status { get; set; } = "active";

        public int GreenhouseId { get; set; }
    }
}
