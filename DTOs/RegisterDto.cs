namespace FarmManagement.API.DTOs
{
    /// <summary>
    /// Every other DTO in this project initializes its string properties to
    /// string.Empty. This one didn't - the only DTO that was missing it.
    /// With &lt;Nullable&gt;enable&lt;/Nullable&gt; set in the .csproj, a non-nullable
    /// `string` property with no initializer can end up genuinely null after
    /// model binding if the client's JSON is missing that key, which is what
    /// let this slip through: nothing about the C# compiles differently, but
    /// the property's *runtime* value differs depending on whether a request
    /// included the field at all.
    /// </summary>
    public class RegisterDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Mobile { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;

        public string FarmName { get; set; } = string.Empty;
        public string FarmLocation { get; set; } = string.Empty;
        public string FarmType { get; set; } = string.Empty;
        public decimal FarmArea { get; set; }
        public string AreaUnit { get; set; } = string.Empty;
        public string PrimaryCrop { get; set; } = string.Empty;
    }
}
