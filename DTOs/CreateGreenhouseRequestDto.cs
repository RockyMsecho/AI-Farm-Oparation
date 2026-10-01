namespace FarmManagement.API.DTOs
{
    public class CreateGreenhouseRequestDto
    {
        public string GreenhouseName { get; set; } = string.Empty;
        public string GreenhouseType { get; set; } = string.Empty;
        public decimal Area { get; set; }
        public string Location { get; set; } = string.Empty;
        public int FarmId { get; set; }
    }
}
