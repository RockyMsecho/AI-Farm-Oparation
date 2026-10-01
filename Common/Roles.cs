namespace FarmManagement.API.Common
{
    /// <summary>
    /// Every role string in one place. You currently have "Owner", "Manager",
    /// "Worker", "Agronomist" and "Technician" typed by hand in six files.
    /// One typo in an [Authorize(Roles = "Owner")] attribute silently opens an
    /// endpoint to nobody - or to everybody - and nothing warns you.
    /// </summary>
    public static class Roles
    {
        public const string Owner = "Owner";
        public const string Manager = "Manager";
        public const string Worker = "Worker";
        public const string Agronomist = "Agronomist";
        public const string Technician = "Technician";

        /// <summary>The "management" side of the org chart - Owner and Manager.</summary>
        public static readonly string[] Management = { Owner, Manager };

        /// <summary>Field-level accounts created via POST /api/User, not registration.</summary>
        public static readonly string[] Staff = { Worker, Agronomist, Technician };

        public static readonly string[] All =
            { Owner, Manager, Worker, Agronomist, Technician };

        public const string OwnerOnly = Owner;
        public const string OwnerOrManager = Owner + "," + Manager;
    }
}
