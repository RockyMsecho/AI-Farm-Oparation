namespace FarmManagement.API.Models
{
    /// <summary>
    /// A field report: a Worker or Technician observation, tied to the shift
    /// they were clocked into when they wrote it (same pattern the guide uses
    /// for TreatmentLog/HarvestRecord once those exist - every log entry
    /// belongs to an open shift, not just to "whoever is logged in").
    ///
    /// The recommendation lives directly on the report rather than in a
    /// separate table: a report only ever needs one active recommendation
    /// and one approval decision, so a one-to-many table would be
    /// unnecessary complexity for what this actually is.
    /// </summary>
    public class FieldReport
    {
        public int Id { get; set; }

        public int ShiftId { get; set; }
        public Shift? Shift { get; set; }

        public string Category { get; set; } = string.Empty; // Crop, Livestock, Equipment, Other
        public string Summary { get; set; } = string.Empty;

        /// <summary>Submitted -&gt; Pending approval -&gt; Approved.</summary>
        public string Status { get; set; } = "Submitted";

        public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

        public string? Recommendation { get; set; }
        public int? RecommendedByUserId { get; set; }
        public User? RecommendedByUser { get; set; }
        public DateTime? RecommendedUtc { get; set; }

        public int? ApprovedByUserId { get; set; }
        public User? ApprovedByUser { get; set; }
        public DateTime? ApprovedUtc { get; set; }
    }
}
