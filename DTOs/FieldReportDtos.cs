namespace FarmManagement.API.DTOs
{
    public class CreateFieldReportRequestDto
    {
        public string Category { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
    }

    public class AddRecommendationRequestDto
    {
        public string Text { get; set; } = string.Empty;
    }
}
