using FarmManagement.API.Common;
using FarmManagement.API.Data;
using FarmManagement.API.DTOs;
using FarmManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FarmManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GreenhouseController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public GreenhouseController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [Authorize(Policy = Permissions.GreenhousesCreate)]
        public async Task<IActionResult> CreateGreenhouse(
            CreateGreenhouseRequestDto request,
            CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            if (string.IsNullOrWhiteSpace(request.GreenhouseName))
                return BadRequest(new { message = "Greenhouse name is required." });

            if (string.IsNullOrWhiteSpace(request.GreenhouseType))
                return BadRequest(new { message = "Greenhouse type is required." });

            if (request.Area <= 0)
                return BadRequest(new { message = "Greenhouse area must be greater than 0." });

            if (string.IsNullOrWhiteSpace(request.Location))
                return BadRequest(new { message = "Greenhouse location is required." });

            var greenhouse = new Greenhouse
            {
                GreenhouseName = request.GreenhouseName,
                GreenhouseType = request.GreenhouseType,
                Area = request.Area,
                AreaUnit = "m²",
                Location = request.Location,
                Status = "Active",
                FarmId = currentUser.FarmId.Value
            };

            _context.Greenhouses.Add(greenhouse);
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Greenhouse created successfully.",
                id = greenhouse.Id,
                greenhouseName = greenhouse.GreenhouseName,
                greenhouseType = greenhouse.GreenhouseType,
                area = greenhouse.Area,
                areaUnit = greenhouse.AreaUnit,
                location = greenhouse.Location,
                status = greenhouse.Status,
                farmId = greenhouse.FarmId
            });
        }

        [HttpGet]
        [Authorize(Policy = Permissions.GreenhousesView)]
        public async Task<IActionResult> GetGreenhouses(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var greenhouses = await _context.Greenhouses
                .AsNoTracking()
                .Where(g => g.FarmId == currentUser.FarmId.Value)
                .Select(g => new
                {
                    id = g.Id,
                    greenhouseName = g.GreenhouseName,
                    greenhouseType = g.GreenhouseType,
                    area = g.Area,
                    areaUnit = g.AreaUnit,
                    location = g.Location,
                    status = g.Status,
                    farmId = g.FarmId,
                    zoneCount = g.Zones.Count
                })
                .ToListAsync(ct);

            return Ok(greenhouses);
        }

        [HttpGet("{id:int}")]
        [Authorize(Policy = Permissions.GreenhousesView)]
        public async Task<IActionResult> GetGreenhouse(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var greenhouse = await _context.Greenhouses
                .AsNoTracking()
                .Where(g => g.Id == id && g.FarmId == currentUser.FarmId.Value)
                .Select(g => new
                {
                    id = g.Id,
                    greenhouseName = g.GreenhouseName,
                    greenhouseType = g.GreenhouseType,
                    area = g.Area,
                    areaUnit = g.AreaUnit,
                    location = g.Location,
                    status = g.Status,
                    farmId = g.FarmId,
                    farmName = g.Farm!.FarmName
                })
                .FirstOrDefaultAsync(ct);

            if (greenhouse is null)
                return NotFound(new { message = "Greenhouse not found." });

            return Ok(greenhouse);
        }
    }
}
