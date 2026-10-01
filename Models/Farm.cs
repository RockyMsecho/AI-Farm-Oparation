namespace FarmManagement.API.Models
{
    public class Farm
    {
        public int Id { get; set; }

        public string FarmName { get; set; } = string.Empty;

        public string FarmLocation { get; set; } = string.Empty;

        public string FarmType { get; set; } = string.Empty;

        public decimal FarmArea { get; set; }

        public string AreaUnit { get; set; } = "m²";

        public string PrimaryCrop { get; set; } = string.Empty;

        public int OwnerId { get; set; }
        public User? Owner { get; set; }

        public ICollection<User> Members { get; set; } = new List<User>();

        public ICollection<Greenhouse> Greenhouses { get; set; } = new List<Greenhouse>();
    }
}
