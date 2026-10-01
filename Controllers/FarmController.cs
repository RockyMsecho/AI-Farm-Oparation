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
    public class FarmController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FarmController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [Authorize(Policy = Permissions.FarmsCreate)]
        public async Task<IActionResult> CreateFarm(CreateFarmRequestDto request, CancellationToken ct)
        {
            if (request is null)
                return BadRequest(new { message = "Farm information is required." });

            if (string.IsNullOrWhiteSpace(request.FarmName))
                return BadRequest(new { message = "Farm name is required." });

            if (string.IsNullOrWhiteSpace(request.FarmLocation))
                return BadRequest(new { message = "Farm location is required." });

            if (string.IsNullOrWhiteSpace(request.FarmType))
                return BadRequest(new { message = "Farm type is required." });

            if (request.FarmSize <= 0)
                return BadRequest(new { message = "Farm size must be greater than 0." });

            if (string.IsNullOrWhiteSpace(request.MainCrop))
                return BadRequest(new { message = "Main crop is required." });

            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var farm = new Farm
            {
                FarmName = request.FarmName,
                FarmLocation = request.FarmLocation,
                FarmType = request.FarmType,
                FarmArea = request.FarmSize,
                AreaUnit = "hectares",
                PrimaryCrop = request.MainCrop,
                OwnerId = currentUser.Id
            };

            _context.Farms.Add(farm);
            await _context.SaveChangesAsync(ct);

            currentUser.FarmId = farm.Id;
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Farm created successfully.",
                id = farm.Id,
                farmName = farm.FarmName,
                farmLocation = farm.FarmLocation,
                farmType = farm.FarmType,
                farmArea = farm.FarmArea,
                areaUnit = farm.AreaUnit,
                primaryCrop = farm.PrimaryCrop,
                ownerId = farm.OwnerId
            });
        }

        [HttpGet("my-farm")]
        [Authorize(Policy = Permissions.FarmsView)]
        public async Task<IActionResult> GetMyFarm(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (currentUser.FarmId is null)
                return NotFound(new { message = "No farm is associated with this user." });

            var farm = await _context.Farms
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == currentUser.FarmId, ct);

            if (farm is null)
                return NotFound(new { message = "Farm not found." });

            return Ok(new
            {
                id = farm.Id,
                farmName = farm.FarmName,
                farmLocation = farm.FarmLocation,
                farmType = farm.FarmType,
                farmArea = farm.FarmArea,
                areaUnit = farm.AreaUnit,
                primaryCrop = farm.PrimaryCrop,
                ownerId = farm.OwnerId
            });
        }


        [HttpGet("{id:int}")]
        [Authorize(Policy = Permissions.FarmsView)]
        public async Task<IActionResult> GetFarm(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (currentUser.FarmId != id)
                return NotFound(new { message = "Farm not found." });

            var farm = await _context.Farms
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Id == id, ct);

            if (farm is null)
                return NotFound(new { message = "Farm not found." });

            return Ok(new
            {
                id = farm.Id,
                farmName = farm.FarmName,
                farmLocation = farm.FarmLocation,
                farmType = farm.FarmType,
                farmArea = farm.FarmArea,
                areaUnit = farm.AreaUnit,
                primaryCrop = farm.PrimaryCrop,
                ownerId = farm.OwnerId
            });
        }
    }
}
