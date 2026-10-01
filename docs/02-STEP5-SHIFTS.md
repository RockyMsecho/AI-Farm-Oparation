# Step 5 — Clock In / Clock Out

Built against your actual project: plain `User` table with `int` id, your
hand-rolled JWT, your `Roles` constants and `CurrentUserExtensions.GetUserId()`
from the earlier fix — not the ASP.NET Identity version from the reference
backend. This drops straight into what you already have.

## Files

| File | Goes to |
|---|---|
| `Models/Shift.cs` | `Models/Shift.cs` |
| `DTOs/ClockRequestDto.cs` | `DTOs/ClockRequestDto.cs` |
| `Controllers/ShiftsController.cs` | `Controllers/ShiftsController.cs` |
| `Data/ApplicationDbContext.Shift.diff.cs` | **not a file to copy** — instructions for two additions to your existing `Data/ApplicationDbContext.cs` |

## Wiring it in

1. Copy `Shift.cs`, `ClockRequestDto.cs`, `ShiftsController.cs` into your project at the paths above.
2. Open `Data/ApplicationDbContext.cs` and make the two additions shown in the diff file: the `DbSet<Shift>` and the three lines in `OnModelCreating`.
3. Migrate:

```bash
dotnet ef migrations add AddShifts
dotnet ef database update
```

## Trying it

```
POST /api/shifts/clock-in          (empty body {} is fine)
GET  /api/shifts/current           -> isClockedIn: true, with the shift id
POST /api/shifts/clock-out         -> returns hoursWorked
GET  /api/shifts/history           -> your last 30 shifts
```

All four just need `Authorize` — any of your five roles can call them, since
everyone who logs work needs a shift, not only Field Workers.

## Why the summary only shows hours right now

`BuildSummaryAsync` doesn't reference `TreatmentLogs`, `FeedLogs` or
`HarvestRecords` yet, because those tables don't exist in your project until
Step 6 and Step 7 are built. Referencing a `DbSet` that doesn't exist won't
compile. The method has the exact lines commented in, ready to uncomment once
those tables land — nothing else about the controller needs to change.

## What Step 6 will depend on this for

When you build Crop tracking next, every `TreatmentLog` and `HarvestRecord`
row needs a `ShiftId`, filled in from the caller's *open* shift — not sent by
the client. The pattern is:

```csharp
var userId = User.GetUserId();
var openShift = await _context.Shifts
    .Where(s => s.UserId == userId && s.ClockOutUtc == null)
    .OrderByDescending(s => s.ClockInUtc)
    .FirstOrDefaultAsync(ct);

if (openShift is null)
    return Conflict(new { message = "You must clock in before logging work." });

// then: new TreatmentLog { ..., ShiftId = openShift.Id }
```

That's the same lookup `GetOpenShiftAsync` does here — worth pulling into a
small shared service once you have three or four controllers doing it, so the
rule exists in one place instead of copy-pasted into Crop, Livestock and
wherever else needs it.
