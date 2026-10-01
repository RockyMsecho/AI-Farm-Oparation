using FarmManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Farm> Farms { get; set; }
        public DbSet<Greenhouse> Greenhouses { get; set; }
        public DbSet<Zone> Zones { get; set; }
        public DbSet<Shift> Shifts { get; set; }
        public DbSet<FieldReport> FieldReports { get; set; }
        public DbSet<CropVariety> CropVarieties { get; set; }
        public DbSet<CropPlanting> CropPlantings { get; set; }
        public DbSet<CropActivity> CropActivities { get; set; }
        public DbSet<CropObservation> CropObservations { get; set; }
        public DbSet<HarvestRecord> HarvestRecords { get; set; }
        public DbSet<LivestockBatch> LivestockBatches { get; set; }
        public DbSet<LivestockHealthRecord> LivestockHealthRecords { get; set; }
        public DbSet<LivestockVaccination> LivestockVaccinations { get; set; }
        public DbSet<LivestockLog> LivestockLogs { get; set; }
        public DbSet<LivestockProduction> LivestockProductions { get; set; }
        public DbSet<LivestockBreeding> LivestockBreedings { get; set; }
        public DbSet<InventoryItem> InventoryItems { get; set; }
        public DbSet<InventoryUsage> InventoryUsages { get; set; }
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<PurchaseLog> PurchaseLogs { get; set; }
        public DbSet<OperatingCost> OperatingCosts { get; set; }
        public DbSet<FarmTask> FarmTasks { get; set; }
        public DbSet<TaskHistory> TaskHistories { get; set; }

        public DbSet<Role> Roles { get; set; }
        public DbSet<Permission> Permissions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Greenhouse>().ToTable("Greenhouse");

            modelBuilder.Entity<Farm>().Property(f => f.FarmArea).HasPrecision(18, 2);
            modelBuilder.Entity<Greenhouse>().Property(g => g.Area).HasPrecision(18, 2);
            modelBuilder.Entity<Zone>().Property(z => z.Area).HasPrecision(18, 2);

            modelBuilder.Entity<HarvestRecord>().Property(x => x.Quantity).HasPrecision(18, 2);
            modelBuilder.Entity<InventoryItem>().Property(x => x.Quantity).HasPrecision(18, 2);
            modelBuilder.Entity<InventoryItem>().Property(x => x.Reorder).HasPrecision(18, 2);
            modelBuilder.Entity<InventoryUsage>().Property(x => x.Quantity).HasPrecision(18, 2);
            modelBuilder.Entity<OperatingCost>().Property(x => x.Amount).HasPrecision(18, 2);


            modelBuilder.Entity<User>().Property(u => u.Email).HasMaxLength(256).IsRequired();
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<User>().Property(u => u.Name).HasMaxLength(200).IsRequired();
            modelBuilder.Entity<User>().Property(u => u.Phone).HasMaxLength(30);
            modelBuilder.Entity<User>().Property(u => u.PasswordHash).HasMaxLength(200).IsRequired();
            modelBuilder.Entity<User>().Property(u => u.PasswordResetTokenHash).HasMaxLength(64);
            modelBuilder.Entity<User>().HasIndex(u => u.PasswordResetTokenHash);

            modelBuilder.Entity<User>()
                .HasOne(u => u.Farm)
                .WithMany(f => f.Members)
                .HasForeignKey(u => u.FarmId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Farm>()
                .HasOne(f => f.Owner)
                .WithOne(u => u.OwnedFarm)
                .HasForeignKey<Farm>(f => f.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Greenhouse>()
                .HasOne(g => g.Farm)
                .WithMany(f => f.Greenhouses)
                .HasForeignKey(g => g.FarmId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Zone>()
                .HasOne(z => z.Greenhouse)
                .WithMany(g => g.Zones)
                .HasForeignKey(z => z.GreenhouseId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CropVariety>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<CropPlanting>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<CropActivity>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<CropObservation>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<HarvestRecord>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockBatch>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockHealthRecord>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockVaccination>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockLog>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockProduction>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LivestockBreeding>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<InventoryItem>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<InventoryUsage>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Supplier>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PurchaseLog>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<OperatingCost>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<FarmTask>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<TaskHistory>().HasOne(x => x.Farm).WithMany().HasForeignKey(x => x.FarmId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<TaskHistory>().HasOne(x => x.FarmTask).WithMany().HasForeignKey(x => x.FarmTaskId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Shift>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Shift>().Ignore(s => s.IsOpen);

            modelBuilder.Entity<Shift>()
                .HasIndex(s => new { s.UserId, s.ClockOutUtc });

            modelBuilder.Entity<FieldReport>()
                .HasOne(r => r.Shift)
                .WithMany()
                .HasForeignKey(r => r.ShiftId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FieldReport>()
                .HasOne(r => r.RecommendedByUser)
                .WithMany()
                .HasForeignKey(r => r.RecommendedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FieldReport>()
                .HasOne(r => r.ApprovedByUser)
                .WithMany()
                .HasForeignKey(r => r.ApprovedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FieldReport>().Property(r => r.Category).HasMaxLength(50).IsRequired();
            modelBuilder.Entity<FieldReport>().Property(r => r.Summary).HasMaxLength(2000).IsRequired();
            modelBuilder.Entity<FieldReport>().Property(r => r.Status).HasMaxLength(30).IsRequired();
            modelBuilder.Entity<FieldReport>().Property(r => r.Recommendation).HasMaxLength(2000);

            modelBuilder.Entity<FieldReport>().HasIndex(r => r.Status);


            modelBuilder.Entity<Role>().Property(r => r.Name).HasMaxLength(50).IsRequired();
            modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();

            modelBuilder.Entity<Permission>().Property(p => p.Name).HasMaxLength(100).IsRequired();
            modelBuilder.Entity<Permission>().HasIndex(p => p.Name).IsUnique();
            modelBuilder.Entity<Permission>().Property(p => p.Description).HasMaxLength(500);

            modelBuilder.Entity<Role>()
                .HasMany(r => r.Permissions)
                .WithMany(p => p.Roles)
                .UsingEntity(j => j.ToTable("RolePermissions"));

            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
