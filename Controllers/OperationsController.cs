using FarmManagement.API.Authorization;
using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.DTOs;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Permissions.OperationsView)]
public class OperationsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public OperationsController(ApplicationDbContext db) => _db = db;

    private async Task<User?> CurrentUser(CancellationToken ct) => await User.GetCurrentUserAsync(_db, ct);
    private static IActionResult NoFarm() => new BadRequestObjectResult(new { message = "The current user is not connected to a farm." });

    [HttpGet("activity-trend")]
    public async Task<IActionResult> GetActivityTrend([FromQuery] int days = 14, CancellationToken ct = default)
    {
        var u = await CurrentUser(ct);
        if (u is null) return Unauthorized();
        if (!u.FarmId.HasValue) return NoFarm();

        days = Math.Clamp(days, 7, 31);
        var endDate = DateTime.UtcNow.Date;
        var startDate = endDate.AddDays(-(days - 1));
        var farmId = u.FarmId.Value;

        var cropActivityDates = await _db.CropActivities.AsNoTracking()
            .Where(x => x.FarmId == farmId && x.CreatedAt >= startDate)
            .Select(x => x.CreatedAt)
            .ToListAsync(ct);

        var livestockLogDates = await _db.LivestockLogs.AsNoTracking()
            .Where(x => x.FarmId == farmId && x.CreatedAt >= startDate)
            .Select(x => x.CreatedAt)
            .ToListAsync(ct);

        var inventoryUsageDates = await _db.InventoryUsages.AsNoTracking()
            .Where(x => x.FarmId == farmId && x.CreatedAt >= startDate)
            .Select(x => x.CreatedAt)
            .ToListAsync(ct);

        var taskDates = await _db.FarmTasks.AsNoTracking()
            .Where(x => x.FarmId == farmId && x.CreatedAt >= startDate)
            .Select(x => x.CreatedAt)
            .ToListAsync(ct);

        var taskHistoryDates = await _db.TaskHistories.AsNoTracking()
            .Where(x => x.FarmId == farmId && x.CreatedAt >= startDate)
            .Select(x => x.CreatedAt)
            .ToListAsync(ct);

        var allDates = cropActivityDates
            .Concat(livestockLogDates)
            .Concat(inventoryUsageDates)
            .Concat(taskDates)
            .Concat(taskHistoryDates);

        var counts = allDates
            .GroupBy(x => x.ToUniversalTime().Date)
            .ToDictionary(g => g.Key, g => g.Count());

        var trend = Enumerable.Range(0, days)
            .Select(i =>
            {
                var date = startDate.AddDays(i);
                return new
                {
                    date = date.ToString("MMM d"),
                    activity = counts.TryGetValue(date, out var count) ? count : 0
                };
            })
            .ToList();

        return Ok(new { days, startDate, endDate, trend });
    }

    [HttpGet("crops")]
    public async Task<IActionResult> GetCrops(CancellationToken ct)
    {
        var u = await CurrentUser(ct); if (u is null) return Unauthorized(); if (!u.FarmId.HasValue) return NoFarm();
        var farmId = u.FarmId.Value;
        return Ok(new {
            varieties = await _db.CropVarieties.AsNoTracking().Where(x=>x.FarmId==farmId).OrderByDescending(x=>x.Id).ToListAsync(ct),
            plantings = await _db.CropPlantings.AsNoTracking().Where(x=>x.FarmId==farmId).OrderByDescending(x=>x.Id).ToListAsync(ct),
            activities = await _db.CropActivities.AsNoTracking().Where(x=>x.FarmId==farmId).OrderByDescending(x=>x.Id).ToListAsync(ct),
            observations = await _db.CropObservations.AsNoTracking().Where(x=>x.FarmId==farmId).OrderByDescending(x=>x.Id).ToListAsync(ct),
            harvests = await _db.HarvestRecords.AsNoTracking().Where(x=>x.FarmId==farmId).OrderByDescending(x=>x.Id).ToListAsync(ct)
        });
    }

    [HttpPost("crops/varieties")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> AddVariety(CropVarietyDto d, CancellationToken ct)
    { return await AddCrop(d, ct); }
    private async Task<IActionResult> AddCrop(CropVarietyDto d, CancellationToken ct)
    {
        var u=await CurrentUser(ct); if(u is null)return Unauthorized(); if(!u.FarmId.HasValue)return NoFarm();
        if(string.IsNullOrWhiteSpace(d.Crop)||string.IsNullOrWhiteSpace(d.Variety))return BadRequest(new{message="Crop and variety are required."});
        var x=new CropVariety{FarmId=u.FarmId.Value,Crop=d.Crop.Trim(),Variety=d.Variety.Trim(),Notes=d.Notes?.Trim()??""}; _db.CropVarieties.Add(x); await _db.SaveChangesAsync(ct); return Ok(x);
    }
    [HttpDelete("crops/varieties/{id:int}")]
    [Authorize(Policy = Permissions.CropManage)]
    public Task<IActionResult> DeleteVariety(int id,CancellationToken ct)=>DeleteByFarm(_db.CropVarieties,id,ct);

    [HttpPost("crops/plantings")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> AddPlanting(CropPlantingDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();if(string.IsNullOrWhiteSpace(d.Crop)||string.IsNullOrWhiteSpace(d.Field))return BadRequest(new{message="Crop and field are required."});var x=new CropPlanting{FarmId=u.FarmId.Value,Crop=d.Crop.Trim(),Field=d.Field.Trim(),Planted=d.Planted,ExpectedHarvest=d.ExpectedHarvest,Stage=string.IsNullOrWhiteSpace(d.Stage)?"Germination":d.Stage!,Status="ok"};_db.CropPlantings.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }

    [HttpDelete("crops/plantings/{id:int}")]
    [Authorize(Policy = Permissions.CropManage)]
    public Task<IActionResult> DeletePlanting(int id,CancellationToken ct)=>DeleteByFarm(_db.CropPlantings,id,ct);

    [HttpPut("crops/plantings/{id:int}/stage")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> UpdatePlantingStage(int id,[FromBody] Dictionary<string,string> d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=await _db.CropPlantings.FirstOrDefaultAsync(a=>a.Id==id&&a.FarmId==u.FarmId.Value,ct);if(x is null)return NotFound(new{message="Planting not found."});if(d.TryGetValue("stage",out var stage)&&!string.IsNullOrWhiteSpace(stage))x.Stage=stage;if(d.TryGetValue("status",out var status)&&!string.IsNullOrWhiteSpace(status))x.Status=status;await _db.SaveChangesAsync(ct);return Ok(x); }

    [HttpPost("crops/activities")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> AddCropActivity(CropActivityDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=new CropActivity{FarmId=u.FarmId.Value,Type=d.Type,Text=d.Text,Who=d.Who};_db.CropActivities.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpDelete("crops/activities/{id:int}")]
    [Authorize(Policy = Permissions.CropManage)]
    public Task<IActionResult> DeleteCropActivity(int id,CancellationToken ct)=>DeleteByFarm(_db.CropActivities,id,ct);

    [HttpPost("crops/observations")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> AddCropObservation(CropObservationDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=new CropObservation{FarmId=u.FarmId.Value,Field=d.Field,Text=d.Text,Severity=d.Severity,Who=d.Who};_db.CropObservations.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpDelete("crops/observations/{id:int}")]
    [Authorize(Policy = Permissions.CropManage)]
    public Task<IActionResult> DeleteCropObservation(int id,CancellationToken ct)=>DeleteByFarm(_db.CropObservations,id,ct);

    [HttpPost("crops/harvests")]
    [Authorize(Policy = Permissions.CropManage)]
    public async Task<IActionResult> AddHarvest(HarvestDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();if(d.Quantity<0)return BadRequest(new{message="Yield cannot be negative."});var x=new HarvestRecord{FarmId=u.FarmId.Value,Crop=d.Crop,Field=d.Field,Date=d.Date,Quantity=d.Quantity,Unit=d.Unit};_db.HarvestRecords.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpDelete("crops/harvests/{id:int}")]
    [Authorize(Policy = Permissions.CropManage)]
    public Task<IActionResult> DeleteHarvest(int id,CancellationToken ct)=>DeleteByFarm(_db.HarvestRecords,id,ct);

    [HttpGet("livestock")]
    public async Task<IActionResult> GetLivestock(CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var f=u.FarmId.Value;return Ok(new{batches=await _db.LivestockBatches.AsNoTracking().Where(x=>x.FarmId==f).ToListAsync(ct),health=await _db.LivestockHealthRecords.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct),vaccinations=await _db.LivestockVaccinations.AsNoTracking().Where(x=>x.FarmId==f).OrderBy(x=>x.Due).ToListAsync(ct),logs=await _db.LivestockLogs.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct),production=await _db.LivestockProductions.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct),breeding=await _db.LivestockBreedings.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct)}); }

    [HttpPost("livestock/batches")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddLivestock(LivestockBatchDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=new LivestockBatch{FarmId=u.FarmId.Value,Name=d.Name,Size=d.Size,Purpose=d.Purpose,Stage=d.Stage,Status="ok"};_db.LivestockBatches.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpPut("livestock/batches/{id:int}/status")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> UpdateLivestockStatus(int id,[FromBody] Dictionary<string,string> d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=await _db.LivestockBatches.FirstOrDefaultAsync(a=>a.Id==id&&a.FarmId==u.FarmId.Value,ct);if(x is null)return NotFound(new{message="Livestock batch not found."});if(d.TryGetValue("status",out var status)&&!string.IsNullOrWhiteSpace(status))x.Status=status;await _db.SaveChangesAsync(ct);return Ok(x); }

    [HttpDelete("livestock/batches/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteLivestock(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockBatches,id,ct);
    [HttpPost("livestock/health")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddLivestockHealth(LivestockHealthDto d,CancellationToken ct)=>await AddEntity(d, (u,x)=>new LivestockHealthRecord{FarmId=u.FarmId!.Value,Batch=x.Batch,Text=x.Text,Who=x.Who}, _db.LivestockHealthRecords, ct);
    [HttpDelete("livestock/health/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteLivestockHealth(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockHealthRecords,id,ct);
    [HttpPost("livestock/vaccinations")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddVaccination(VaccinationDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new LivestockVaccination{FarmId=u.FarmId!.Value,Batch=x.Batch,Vaccine=x.Vaccine,Due=x.Due,Status="Scheduled"},_db.LivestockVaccinations,ct);
    [HttpPut("livestock/vaccinations/{id:int}/status")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> UpdateVaccinationStatus(int id,[FromBody] Dictionary<string,string> d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=await _db.LivestockVaccinations.FirstOrDefaultAsync(a=>a.Id==id&&a.FarmId==u.FarmId.Value,ct);if(x is null)return NotFound(new{message="Vaccination not found."});if(d.TryGetValue("status",out var status)&&!string.IsNullOrWhiteSpace(status))x.Status=status;await _db.SaveChangesAsync(ct);return Ok(x); }

    [HttpDelete("livestock/vaccinations/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteVaccination(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockVaccinations,id,ct);
    [HttpPost("livestock/logs")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddLivestockLog(LivestockLogDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new LivestockLog{FarmId=u.FarmId!.Value,Type=x.Type,Text=x.Text,Who=x.Who},_db.LivestockLogs,ct);
    [HttpDelete("livestock/logs/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteLivestockLog(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockLogs,id,ct);
    [HttpPost("livestock/production")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddProduction(LivestockProductionDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new LivestockProduction{FarmId=u.FarmId!.Value,Batch=x.Batch,Metric=x.Metric,Value=x.Value,Date=x.Date},_db.LivestockProductions,ct);
    [HttpDelete("livestock/production/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteProduction(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockProductions,id,ct);
    [HttpPost("livestock/breeding")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public async Task<IActionResult> AddBreeding(LivestockBreedingDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new LivestockBreeding{FarmId=u.FarmId!.Value,Batch=x.Batch,Event=x.Event,Date=x.Date,Notes=x.Notes??""},_db.LivestockBreedings,ct);
    [HttpDelete("livestock/breeding/{id:int}")]
    [Authorize(Policy = Permissions.LivestockManage)]
    public Task<IActionResult> DeleteBreeding(int id,CancellationToken ct)=>DeleteByFarm(_db.LivestockBreedings,id,ct);

    [HttpGet("inventory")]
    public async Task<IActionResult> GetInventory(CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var f=u.FarmId.Value;return Ok(new{items=await _db.InventoryItems.AsNoTracking().Where(x=>x.FarmId==f).ToListAsync(ct),usage=await _db.InventoryUsages.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct),suppliers=await _db.Suppliers.AsNoTracking().Where(x=>x.FarmId==f).ToListAsync(ct),purchases=await _db.PurchaseLogs.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct),costs=await _db.OperatingCosts.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).ToListAsync(ct)}); }
    [HttpPost("inventory/items")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> AddInventory(InventoryItemDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new InventoryItem{FarmId=u.FarmId!.Value,Item=x.Item,Category=x.Category,Quantity=x.Quantity,Unit=x.Unit,Reorder=x.Reorder},_db.InventoryItems,ct);
    [HttpPut("inventory/items/{id:int}/quantity")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> AdjustInventoryQuantity(int id, [FromBody] Dictionary<string,decimal> d, CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=await _db.InventoryItems.FirstOrDefaultAsync(a=>a.Id==id&&a.FarmId==u.FarmId.Value,ct);if(x is null)return NotFound(new{message="Inventory item not found."});if(!d.TryGetValue("delta",out var delta))return BadRequest(new{message="Quantity change is required."});x.Quantity=Math.Max(0,x.Quantity+delta);await _db.SaveChangesAsync(ct);return Ok(x); }

    [HttpDelete("inventory/items/{id:int}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public Task<IActionResult> DeleteInventory(int id,CancellationToken ct)=>DeleteByFarm(_db.InventoryItems,id,ct);
    [HttpPost("inventory/usage")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> UseInventory(InventoryUsageDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();if(d.Quantity<=0)return BadRequest(new{message="Usage quantity must be greater than 0."});var item=await _db.InventoryItems.FirstOrDefaultAsync(x=>x.FarmId==u.FarmId.Value&&x.Item==d.Item,ct);if(item is null)return NotFound(new{message="Inventory item not found."});if(item.Quantity<d.Quantity)return BadRequest(new{message="Not enough stock available."});item.Quantity-=d.Quantity;var x=new InventoryUsage{FarmId=u.FarmId.Value,Item=d.Item,Quantity=d.Quantity,Unit=d.Unit,UsedFor=d.UsedFor,Who=d.Who};_db.InventoryUsages.Add(x);await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpPost("inventory/suppliers")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> AddSupplier(SupplierDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new Supplier{FarmId=u.FarmId!.Value,Name=x.Name,Contact=x.Contact,Category=x.Category},_db.Suppliers,ct);
    [HttpDelete("inventory/suppliers/{id:int}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public Task<IActionResult> DeleteSupplier(int id,CancellationToken ct)=>DeleteByFarm(_db.Suppliers,id,ct);
    [HttpPost("inventory/purchases")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> AddPurchase(PurchaseLogDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new PurchaseLog{FarmId=u.FarmId!.Value,Type=x.Type,Text=x.Text,Who=x.Who,Status=x.Type=="Request"?"Pending":"Placed"},_db.PurchaseLogs,ct);
    [HttpDelete("inventory/purchases/{id:int}")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public Task<IActionResult> DeletePurchase(int id,CancellationToken ct)=>DeleteByFarm(_db.PurchaseLogs,id,ct);
    [HttpPost("inventory/costs")]
    [Authorize(Policy = Permissions.InventoryManage)]
    public async Task<IActionResult> AddCost(OperatingCostDto d,CancellationToken ct)=>await AddEntity(d,(u,x)=>new OperatingCost{FarmId=u.FarmId!.Value,Date=x.Date,Category=x.Category,Description=x.Description,Amount=x.Amount},_db.OperatingCosts,ct);

    [HttpGet("tasks")]
    public async Task<IActionResult> GetTasks(CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var f=u.FarmId.Value;return Ok(new{tasks=await _db.FarmTasks.AsNoTracking().Where(x=>x.FarmId==f).OrderBy(x=>x.Deadline).ToListAsync(ct),history=await _db.TaskHistories.AsNoTracking().Where(x=>x.FarmId==f).OrderByDescending(x=>x.Id).Take(100).ToListAsync(ct)}); }
    [HttpPost("tasks")]
    [Authorize(Policy = Permissions.TasksManage)]
    public async Task<IActionResult> AddTask(FarmTaskDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=new FarmTask{FarmId=u.FarmId.Value,Title=d.Title,Link=d.Link??"",Assignee=d.Assignee,Priority=d.Priority,Deadline=d.Deadline,Status="Pending"};_db.FarmTasks.Add(x);await _db.SaveChangesAsync(ct);_db.TaskHistories.Add(new TaskHistory{FarmId=u.FarmId.Value,FarmTaskId=x.Id,Action="Task created",Status=x.Status,ChangedBy=u.Name});await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpPut("tasks/{id:int}/status")]
    [Authorize(Policy = Permissions.TasksManage)]
    public async Task<IActionResult> UpdateTaskStatus(int id,TaskStatusDto d,CancellationToken ct)
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var x=await _db.FarmTasks.FirstOrDefaultAsync(a=>a.Id==id&&a.FarmId==u.FarmId.Value,ct);if(x is null)return NotFound(new{message="Task not found."});var allowed=new[]{"Pending","In Progress","Completed","Cancelled"};if(!allowed.Contains(d.Status))return BadRequest(new{message="Invalid task status."});x.Status=d.Status;x.CompletedAt=d.Status=="Completed"?DateTime.UtcNow:null;_db.TaskHistories.Add(new TaskHistory{FarmId=u.FarmId.Value,FarmTaskId=x.Id,Action=$"Status changed to {x.Status}",Status=x.Status,ChangedBy=u.Name});await _db.SaveChangesAsync(ct);return Ok(x); }
    [HttpDelete("tasks/{id:int}")]
    [Authorize(Policy = Permissions.TasksManage)]
    public Task<IActionResult> DeleteTask(int id,CancellationToken ct)=>DeleteByFarm(_db.FarmTasks,id,ct);

    private async Task<IActionResult> AddEntity<TDto,TEntity>(TDto dto,Func<User,TDto,TEntity> factory,DbSet<TEntity> set,CancellationToken ct) where TEntity:class
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var entity=factory(u,dto);set.Add(entity);await _db.SaveChangesAsync(ct);return Ok(entity); }

    private async Task<IActionResult> DeleteByFarm<TEntity>(DbSet<TEntity> set,int id,CancellationToken ct) where TEntity:class
    { var u=await CurrentUser(ct);if(u is null)return Unauthorized();if(!u.FarmId.HasValue)return NoFarm();var entity=await set.FindAsync(new object[]{id},ct);if(entity is null)return NotFound(new{message="Record not found."});var farmProp=typeof(TEntity).GetProperty("FarmId");if(farmProp is null||farmProp.GetValue(entity) is not int farmId||farmId!=u.FarmId.Value)return NotFound(new{message="Record not found."});set.Remove(entity);await _db.SaveChangesAsync(ct);return Ok(new{message="Record removed."}); }
}
