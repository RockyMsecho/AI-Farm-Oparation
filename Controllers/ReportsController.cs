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
    /// Field reports: Worker/Technician submit an observation from the field;
    /// Owner/Manager/Agronomist can see every report on the farm and add a
    /// recommendation; only Owner/Manager can approve one. This mirrors the
    /// "What each role can do" table on the dashboard's Users &amp; Roles tab
    /// exactly - this controller is what makes that table a real security
    /// boundary instead of just documentation.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportsController(ApplicationDbContext context)
        {
            _context = context;
        }


        [HttpPost]
        [Authorize(Policy = Permissions.ReportsCreate)]
        public async Task<IActionResult> Create(CreateFieldReportRequestDto request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Summary))
                return BadRequest(new { message = "Describe what you observed." });

            var userId = User.GetUserId();
            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var openShift = await _context.Shifts
                .Where(s => s.UserId == userId.Value && s.ClockOutUtc == null)
                .OrderByDescending(s => s.ClockInUtc)
                .FirstOrDefaultAsync(ct);

            if (openShift is null)
                return Conflict(new { message = "You must clock in before submitting a report." });

            var report = new FieldReport
            {
                ShiftId = openShift.Id,
                Category = string.IsNullOrWhiteSpace(request.Category) ? "Other" : request.Category,
                Summary = request.Summary.Trim(),
                Status = "Submitted"
            };

            _context.FieldReports.Add(report);
            await _context.SaveChangesAsync(ct);

            return Ok(new { report.Id, report.Status });
        }


        [HttpGet]
        [Authorize(Policy = Permissions.ReportsView)]
        public async Task<IActionResult> GetAll(CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);
            if (currentUser?.FarmId is null)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var reports = await Project(
                    _context.FieldReports
                        .AsNoTracking()
                        .Where(r => r.Shift!.User!.FarmId == currentUser.FarmId)
                        .OrderByDescending(r => r.CreatedUtc))
                .ToListAsync(ct);

            return Ok(reports);
        }


        [HttpGet("mine")]
        [Authorize(Policy = Permissions.ReportsCreate)]
        public async Task<IActionResult> GetMine(CancellationToken ct)
        {
            var userId = User.GetUserId();
            if (userId is null)
                return Unauthorized(new { message = "Unable to identify the logged-in user." });

            var reports = await Project(
                    _context.FieldReports
                        .AsNoTracking()
                        .Where(r => r.Shift!.UserId == userId.Value)
                        .OrderByDescending(r => r.CreatedUtc))
                .ToListAsync(ct);

            return Ok(reports);
        }


        [HttpPost("{id:int}/recommendation")]
        [Authorize(Policy = Permissions.ReportsRecommend)]
        public async Task<IActionResult> AddRecommendation(int id, AddRecommendationRequestDto request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Text))
                return BadRequest(new { message = "Recommendation text is required." });

            var currentUser = await User.GetCurrentUserAsync(_context, ct);
            if (currentUser?.FarmId is null)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var report = await _context.FieldReports
                .Include(r => r.Shift).ThenInclude(s => s!.User)
                .FirstOrDefaultAsync(r => r.Id == id && r.Shift!.User!.FarmId == currentUser.FarmId, ct);

            if (report is null)
                return NotFound(new { message = "Report not found." });

            report.Recommendation = request.Text.Trim();
            report.RecommendedByUserId = currentUser.Id;
            report.RecommendedUtc = DateTime.UtcNow;
            report.Status = "Pending approval";

            await _context.SaveChangesAsync(ct);

            return Ok(new { report.Id, report.Status });
        }


        [HttpPut("{id:int}/approve")]
        [Authorize(Policy = Permissions.ReportsApprove)]
        public async Task<IActionResult> Approve(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);
            if (currentUser?.FarmId is null)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var report = await _context.FieldReports
                .Include(r => r.Shift).ThenInclude(s => s!.User)
                .FirstOrDefaultAsync(r => r.Id == id && r.Shift!.User!.FarmId == currentUser.FarmId, ct);

            if (report is null)
                return NotFound(new { message = "Report not found." });

            if (report.Recommendation is null)
                return BadRequest(new { message = "This report doesn't have a recommendation to approve yet." });

            report.Status = "Approved";
            report.ApprovedByUserId = currentUser.Id;
            report.ApprovedUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(ct);

            return Ok(new { report.Id, report.Status });
        }


        [HttpPut("{id:int}/reject")]
        [Authorize(Policy = Permissions.ReportsApprove)]
        public async Task<IActionResult> Reject(int id, CancellationToken ct)
        {
            var currentUser = await User.GetCurrentUserAsync(_context, ct);
            if (currentUser?.FarmId is null)
                return BadRequest(new { message = "The current user is not connected to a farm." });

            var report = await _context.FieldReports
                .Include(r => r.Shift).ThenInclude(s => s!.User)
                .FirstOrDefaultAsync(r => r.Id == id && r.Shift!.User!.FarmId == currentUser.FarmId, ct);

            if (report is null)
                return NotFound(new { message = "Report not found." });

            if (report.Recommendation is null)
                return BadRequest(new { message = "This report doesn't have a recommendation to reject." });

            report.Status = "Rejected";
            report.ApprovedByUserId = currentUser.Id;
            report.ApprovedUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(ct);

            return Ok(new { report.Id, report.Status });
        }


        /// <summary>
        /// One shared projection so the list and "mine" endpoints can never
        /// drift into returning different shapes for the same kind of row -
        /// the frontend's rendering code assumes one shape everywhere.
        /// </summary>
        private static IQueryable<ReportRow> Project(IQueryable<FieldReport> query) =>
            query.Select(r => new ReportRow(
                r.Id,
                r.Shift!.User!.Name,
                r.Shift.User.Role!.Name,
                r.Category,
                r.Summary,
                r.Recommendation,
                r.Status,
                r.CreatedUtc
            ));

        private record ReportRow(
            int id,
            string submittedBy,
            string submittedByRole,
            string category,
            string summary,
            string? recommendation,
            string status,
            DateTime createdUtc);
    }
}
