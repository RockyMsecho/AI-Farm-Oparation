using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.DTOs;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Controllers
{
    /// <summary>
    /// Only the [Authorize] attributes changed from the previous fix - farm
    /// scoping logic is identical. `[Authorize]` with no policy still means
    /// "must be logged in, any role", which is right for the read endpoints:
    /// staff need to view zones, they just can't create, edit or delete them.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ZoneController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ZoneController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [Authorize(Policy = Permissions.ZonesCreate)]
        public async Task<IActionResult> CreateZone(ZoneDto request, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            if (string.IsNullOrWhiteSpace(request.ZoneName))
                return BadRequest(new { message = "Zone name is required." });

            if (request.Area <= 0)
                return BadRequest(new { message = "Zone area must be greater than 0." });

            var greenhouse = await _context.Greenhouses
                .FirstOrDefaultAsync(
                    g => g.Id == request.GreenhouseId && g.FarmId == currentUser.FarmId.Value,
                    ct);

            if (greenhouse is null)
                return NotFound(new { message = "Greenhouse not found." });

            var zone = new Zone
            {
                ZoneName = request.ZoneName,
                ZoneType = request.ZoneType,
                Area = request.Area,
                AreaUnit = request.AreaUnit,
                Status = request.Status,
                GreenhouseId = request.GreenhouseId
            };

            _context.Zones.Add(zone);
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Zone created successfully.",
                zone = new
                {
                    zone.Id, zone.ZoneName, zone.ZoneType, zone.Area,
                    zone.AreaUnit, zone.Status, zone.GreenhouseId
                }
            });
        }

        [HttpGet]
        [Authorize(Policy = Permissions.ZonesView)]
        public async Task<IActionResult> GetZones(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var zones = await _context.Zones
                .AsNoTracking()
                .Where(z => z.Greenhouse!.FarmId == currentUser.FarmId.Value)
                .Select(z => new
                {
                    z.Id, z.ZoneName, z.ZoneType, z.Area, z.AreaUnit, z.Status, z.GreenhouseId
                })
                .ToListAsync(ct);

            return Ok(zones);
        }

        [HttpGet("greenhouse/{greenhouseId:int}")]
        [Authorize(Policy = Permissions.ZonesView)]
        public async Task<IActionResult> GetZonesByGreenhouse(int greenhouseId, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var greenhouseExists = await _context.Greenhouses
                .AnyAsync(g => g.Id == greenhouseId && g.FarmId == currentUser.FarmId.Value, ct);

            if (!greenhouseExists)
                return NotFound(new { message = "Greenhouse not found." });

            var zones = await _context.Zones
                .AsNoTracking()
                .Where(z => z.GreenhouseId == greenhouseId)
                .Select(z => new
                {
                    z.Id, z.ZoneName, z.ZoneType, z.Area, z.AreaUnit, z.Status, z.GreenhouseId
                })
                .ToListAsync(ct);

            return Ok(zones);
        }

        [HttpGet("{id:int}")]
        [Authorize(Policy = Permissions.ZonesView)]
        public async Task<IActionResult> GetZone(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var zone = await _context.Zones
                .AsNoTracking()
                .Where(z => z.Id == id && z.Greenhouse!.FarmId == currentUser.FarmId.Value)
                .Select(z => new
                {
                    z.Id, z.ZoneName, z.ZoneType, z.Area, z.AreaUnit, z.Status, z.GreenhouseId
                })
                .FirstOrDefaultAsync(ct);

            if (zone is null)
                return NotFound(new { message = "Zone not found." });

            return Ok(zone);
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = Permissions.ZonesUpdate)]
        public async Task<IActionResult> UpdateZone(int id, ZoneDto request, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var zone = await _context.Zones
                .FirstOrDefaultAsync(z => z.Id == id && z.Greenhouse!.FarmId == currentUser.FarmId.Value, ct);

            if (zone is null)
                return NotFound(new { message = "Zone not found." });

            var targetGreenhouseValid = await _context.Greenhouses
                .AnyAsync(g => g.Id == request.GreenhouseId && g.FarmId == currentUser.FarmId.Value, ct);

            if (!targetGreenhouseValid)
                return NotFound(new { message = "Greenhouse not found." });

            zone.ZoneName = request.ZoneName;
            zone.ZoneType = request.ZoneType;
            zone.Area = request.Area;
            zone.AreaUnit = request.AreaUnit;
            zone.Status = request.Status;
            zone.GreenhouseId = request.GreenhouseId;

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Zone updated successfully.",
                zone = new
                {
                    zone.Id, zone.ZoneName, zone.ZoneType, zone.Area,
                    zone.AreaUnit, zone.Status, zone.GreenhouseId
                }
            });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = Permissions.ZonesDelete)]
        public async Task<IActionResult> DeleteZone(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var zone = await _context.Zones
                .FirstOrDefaultAsync(z => z.Id == id && z.Greenhouse!.FarmId == currentUser.FarmId.Value, ct);

            if (zone is null)
                return NotFound(new { message = "Zone not found." });

            _context.Zones.Remove(zone);
            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Zone deleted successfully." });
        }
    }
}
