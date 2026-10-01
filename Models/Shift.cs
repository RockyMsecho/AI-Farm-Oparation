namespace FarmManagement.API.Models
{
    /// <summary>
    /// Guide Step 5. One working day for one worker. ClockOutUtc == null means
    /// the shift is still open.
    ///
    /// This is the entity everything else in the guide hangs off: when you
    /// build Step 6 (Crop) and Step 7 (Livestock), every TreatmentLog,
    /// HarvestRecord and FeedLog gets a ShiftId, not a UserId directly. That's
    /// what makes the end-of-day summary (Step 2.2.3) free instead of
    /// something you reconstruct later by timestamp-matching.
    /// </summary>
    public class Shift
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public DateTime ClockInUtc { get; set; }
        public DateTime? ClockOutUtc { get; set; }

        /// <summary>
        /// The time the phone recorded, sent up later by offline sync
        /// (Step 8 / Section 8). Null when the request came in live. Kept
        /// separate from ClockInUtc so you can always tell a real-time
        /// clock-in from a late upload.
        /// </summary>
        public DateTime? DeviceClockInUtc { get; set; }
        public DateTime? DeviceClockOutUtc { get; set; }

        /// <summary>
        /// Not mapped to a column - EF is told to ignore this in
        /// ApplicationDbContext.OnModelCreating. It's just a readable way to
        /// ask "is this shift open?" in C#.
        /// </summary>
        public bool IsOpen => ClockOutUtc == null;
    }
}
