namespace FarmManagement.API.DTOs
{
    /// <summary>
    /// Sent to both clock-in and clock-out. DeviceTimeUtc is what the phone's
    /// clock read at the moment of the action - only meaningful when the
    /// worker was offline and this request is arriving late via sync (Step 8).
    /// Send it as null for a normal, online action.
    /// </summary>
    public class ClockRequestDto
    {
        public DateTime? DeviceTimeUtc { get; set; }
    }
}
