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
    /// Guide Step 5. Any authenticated user - Owner, Manager, Worker,
    /// Agronomist, Technician - can clock themselves in and out. There is no
    /// role restriction here on purpose: everyone who logs work needs a shift,
    /// not just Field Workers.
    ///
    /// Everything reads the caller's own id off the token
    /// (User.GetUserId(), same extension you already use elsewhere) - nobody
    /// can clock another user in or out by passing a different id, because no
    /// endpoint here accepts one.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ShiftsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ShiftsController(ApplicationDbContext context)
        {
            _context = context;
        }


        [HttpPost("clock-in")]
        public async Task<IActionResult> ClockIn(ClockRequestDto? request, CancellationToken ct)
        {
            var userId = User.GetUserId();

            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var existing = await GetOpenShiftAsync(userId.Value, ct);

            if (existing is not null)
            {
                return Ok(new
                {
                    message = "You are already clocked in.",
                    shiftId = existing.Id,
                    clockInUtc = existing.ClockInUtc,
                    isOpen = true
                });
            }

            var shift = new Shift
            {
                UserId = userId.Value,
                ClockInUtc = DateTime.UtcNow,
                DeviceClockInUtc = request?.DeviceTimeUtc
            };

            _context.Shifts.Add(shift);
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Clocked in.",
                shiftId = shift.Id,
                clockInUtc = shift.ClockInUtc,
                isOpen = true
            });
        }


        [HttpPost("clock-out")]
        public async Task<IActionResult> ClockOut(ClockRequestDto? request, CancellationToken ct)
        {
            var userId = User.GetUserId();

            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var shift = await GetOpenShiftAsync(userId.Value, ct);

            if (shift is null)
                return Conflict(new { message = "You are not clocked in." });

            shift.ClockOutUtc = DateTime.UtcNow;
            shift.DeviceClockOutUtc = request?.DeviceTimeUtc;

            await _context.SaveChangesAsync(ct);

            var summary = await BuildSummaryAsync(shift.Id, ct);

            return Ok(summary);
        }


        [HttpGet("current")]
        public async Task<IActionResult> Current(CancellationToken ct)
        {
            var userId = User.GetUserId();

            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var shift = await GetOpenShiftAsync(userId.Value, ct);

            if (shift is null)
                return Ok(new { isClockedIn = false });

            return Ok(new
            {
                isClockedIn = true,
                shiftId = shift.Id,
                clockInUtc = shift.ClockInUtc
            });
        }


        [HttpGet("{shiftId:int}/summary")]
        public async Task<IActionResult> Summary(int shiftId, CancellationToken ct)
        {
            var userId = User.GetUserId();

            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var shift = await _context.Shifts
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

            if (shift is null)
                return NotFound(new { message = "Shift not found." });

            var isOwnerOrManager = User.IsInRole(Roles.Owner) || User.IsInRole(Roles.Manager);

            if (shift.UserId != userId.Value && !isOwnerOrManager)
                return Forbid();

            return Ok(await BuildSummaryAsync(shiftId, ct));
        }


        [HttpGet("history")]
        public async Task<IActionResult> History(CancellationToken ct)
        {
            var userId = User.GetUserId();

            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var shifts = await _context.Shifts
                .AsNoTracking()
                .Where(s => s.UserId == userId.Value)
                .OrderByDescending(s => s.ClockInUtc)
                .Take(30)
                .Select(s => new
                {
                    s.Id,
                    s.ClockInUtc,
                    s.ClockOutUtc,
                    isOpen = s.ClockOutUtc == null
                })
                .ToListAsync(ct);

            return Ok(shifts);
        }


        [HttpGet("team")]
        [Authorize(Policy = Permissions.ShiftsViewTeam)]
        public async Task<IActionResult> TeamShifts(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);

            if (currentUser is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            if (!currentUser.FarmId.HasValue)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var shifts = await _context.Shifts
                .AsNoTracking()
                .Where(s => s.User!.FarmId == currentUser.FarmId.Value)
                .OrderByDescending(s => s.ClockInUtc)
                .Take(200)
                .Select(s => new
                {
                    s.Id,
                    s.UserId,
                    UserName = s.User!.Name,
                    s.ClockInUtc,
                    s.ClockOutUtc,
                    isOpen = s.ClockOutUtc == null
                })
                .ToListAsync(ct);

            var result = shifts.Select(s => new
            {
                s.Id,
                s.UserId,
                s.UserName,
                s.ClockInUtc,
                s.ClockOutUtc,
                s.isOpen,
                hoursWorked = s.ClockOutUtc.HasValue
                    ? Math.Round((s.ClockOutUtc.Value - s.ClockInUtc).TotalHours, 2)
                    : (double?)null
            });

            return Ok(result);
        }


        private Task<Shift?> GetOpenShiftAsync(int userId, CancellationToken ct) =>
            _context.Shifts
                .Where(s => s.UserId == userId && s.ClockOutUtc == null)
                .OrderByDescending(s => s.ClockInUtc)
                .FirstOrDefaultAsync(ct);

        /// <summary>
        /// The Step 6/7 counts are written now so this method doesn't need to
        /// change again once those tables exist - they'll just stop being
        /// zero. Referencing tables that don't exist yet would fail to
        /// compile, so this version only reports hours; the commented block
        /// shows exactly what to uncomment once TreatmentLogs, FeedLogs and
        /// HarvestRecords exist.
        /// </summary>
        private async Task<object> BuildSummaryAsync(int shiftId, CancellationToken ct)
        {
            var shift = await _context.Shifts
                .AsNoTracking()
                .FirstAsync(s => s.Id == shiftId, ct);

            var end = shift.ClockOutUtc ?? DateTime.UtcNow;
            var hoursWorked = Math.Round((end - shift.ClockInUtc).TotalHours, 2);

            return new
            {
                shiftId = shift.Id,
                clockInUtc = shift.ClockInUtc,
                clockOutUtc = shift.ClockOutUtc,
                hoursWorked

            };
        }
    }
}
