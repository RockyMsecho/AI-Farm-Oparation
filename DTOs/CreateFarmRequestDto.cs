namespace FarmManagement.API.DTOs
{
    public class CreateFarmRequestDto
    {
        public string FarmName { get; set; } = string.Empty;


    public string FarmLocation { get; set; } = string.Empty;

        public string FarmType { get; set; } = string.Empty;

        public decimal FarmSize { get; set; }

        public string MainCrop { get; set; } = string.Empty;

        public int OwnerId { get; set; }
    }


}
