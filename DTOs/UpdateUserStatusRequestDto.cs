namespace FarmManagement.API.DTOs
{
    /// <summary>
    /// Replaces [FromBody] bool isActive on PUT /api/user/{id}/status.
    /// </summary>
    public class UpdateUserStatusRequestDto
    {
        public bool IsActive { get; set; }
    }
}
