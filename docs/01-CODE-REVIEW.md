# Code review — FarmManagement.API

Reviewed against the *Farm Management Platform Beginner Guide*.

## Where you are

Steps 1–4 of the guide, plus a Greenhouse layer the guide doesn't mention
(Farm → Greenhouse → Zone instead of Farm → Zone). That's a reasonable
addition for a greenhouse operation — just be aware it's your own design
decision, so nothing downstream in the guide will match it exactly.

Not built yet: Shift / clock in–out (Step 5), Crop (6), Livestock (7),
Inventory (8), Dashboards (9), Offline (10).

## What's already right

Worth saying, because these are things beginners usually get wrong:

- Passwords hashed with BCrypt, never stored or logged in plain text.
- Login returns the same message for "no such email" and "wrong password", so
  an attacker can't discover which emails are registered.
- `UserController` checks `u.FarmId == currentUser.FarmId` on every query, so
  one farm's management can't see another's staff.
- The Owner role is protected from being reassigned, a Manager can't promote
  another Manager, and you can't change your own role or deactivate yourself.
- The `sub` → `NameIdentifier` claim fallback is correct and necessary —
  `JwtSecurityTokenHandler` rewrites `sub` to the long URI during validation,
  so checking only for `sub` finds nothing.
- `AddSecurityDefinition` in Swagger so you can test authenticated endpoints.

---

## 1. A role change is never saved — CRITICAL

`UserController.UpdateUserRole`, around line 421:

```csharp
targetUser.Role = newRole;

return Ok(new { message = "User role updated successfully.", ... });
```

There is no `SaveChangesAsync`. EF tracks the change in memory, the request
ends, the `DbContext` is disposed, and the change is thrown away. The API
returns 200 OK with the new role in the response body, so the frontend
displays it as done. Refresh the page and it's back to the old role.

Fixed in `Controllers/UserController.cs`.

## 2. `User.FarmId` is not a real foreign key — CRITICAL

Your `OnModelCreating` has one relationship between User and Farm:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Farm)
    .WithOne(f => f.Owner)
    .HasForeignKey<Farm>(f => f.OwnerId)
```

That binds the `User.Farm` navigation property to `Farm.OwnerId`. So
`user.Farm` means "the farm this person owns". For every Worker, Manager,
Agronomist and Technician, `user.Farm` is `null` — even though their `FarmId`
column is populated.

And `User.FarmId` itself? Here's what EF generated for it in
`ApplicationDbContextModelSnapshot.cs`:

```csharp
b.Property<int?>("FarmId")
    .HasColumnType("int");
```

A plain integer. No foreign key, no index, no constraint. It is the column
every security check in your app depends on, and the database does not
enforce it at all. `FarmId = 9999` would save without complaint.

The fix is two separate relationships — membership (many users per farm, via
`User.FarmId`) and ownership (one owner per farm, via `Farm.OwnerId`) — with
a distinct navigation property for each. See `Models/User.cs`,
`Models/Farm.cs` and `Data/ApplicationDbContext.cs`.

## 3. Zones and greenhouses have no farm isolation — CRITICAL

`ZoneController` is marked `[Authorize]` with no role and no farm check.
Any logged-in user, from any farm on the server, can call:

| Request | Effect |
|---|---|
| `GET /api/zone` | every zone belonging to every farm |
| `GET /api/zone/5` | another farm's zone |
| `PUT /api/zone/5` | rename it, or move it into their own greenhouse |
| `DELETE /api/zone/5` | delete it |

`GreenhouseController` has the same gap on its GETs, and `CreateGreenhouse`
takes `FarmId` straight from the request body — it checks the farm exists but
never that it's *yours*, so a Manager can attach a greenhouse to a stranger's
farm.

`FarmController.GetFarm(int id)` is `[Authorize]` only, so any user can read
any farm's name, location, size and primary crop by incrementing the id.

The rule to apply everywhere: **the farm id comes from the caller's own
database row, never from the request.** Both controllers rewritten.

## 4. Anyone can register themselves as an Owner — CRITICAL

`POST /api/auth/register` has no `[Authorize]`, and does `Role = request.Role`
with no validation. Anyone who can reach your API can create an Owner account,
or an account with a role like `"Superuser"` that no `[Authorize]` attribute
will ever match.

Register creates a farm, so it can only ever produce an Owner. Hard-code it.
See `Controllers/AuthController.Register.cs`.

## 5. Registration isn't atomic — HIGH

Three sequential `SaveChangesAsync` calls: create user, create farm, link
them. If the second fails, you have a user with no farm — and because the
email is now taken and Register is the only endpoint that creates farms, that
person can never recover. Wrapped in a transaction in the same file.

## 6. Deleting a user destroys their entire farm — HIGH

```csharp
.OnDelete(DeleteBehavior.Cascade)
```

on User → Farm, with Farm → Greenhouse and Greenhouse → Zone also cascading.
Deleting one user row wipes the farm, every greenhouse in it, and every zone
in those. Changed to `Restrict`, which makes the database refuse the delete
while dependent rows exist.

## 7. No unique index on email — MEDIUM

Both `Register` and `CreateUser` check for a duplicate email in C# before
inserting. That check loses a race: two simultaneous requests can both find
nothing and both insert. Then `FirstOrDefaultAsync` at login picks whichever
row the database happens to return. A unique index makes this impossible.

Emails also aren't normalised, so `Sam@farm.com` and `sam@farm.com` are
separate accounts. Both fixed.

## 8. Smaller things

- **`WeatherForecastController.cs` and `WeatherForecast.cs`** — leftover
  template, publicly reachable. Delete both.
- **Missing decimal precision** on `Greenhouse.Area` and `Zone.Area`, so EF
  logs a warning at startup and picks `(18,2)` for you. Set explicitly.
- **`.AllowAnyOrigin()`** in CORS — fine locally, but lock it to your
  frontend's origin before this goes anywhere near a real server.
- **`ClockSkew = TimeSpan.Zero`** with 1-hour tokens. Strict, and it means a
  phone whose clock is 30 seconds fast gets 401s. `TimeSpan.FromMinutes(1)`
  is a safer default.
- **`[FromBody] bool isActive`** on the status endpoint — works, but awkward
  to call and impossible to extend. Replaced with a DTO.
- **No password minimum length** anywhere. A 1-character password is accepted.
- **`RegisterDto`** has non-nullable `string` properties with no initialiser,
  so you're getting nullable warnings. Add `= string.Empty;` to each.
- **`Greenhouse` DbSet is singular** — reads badly as
  `_context.Greenhouse.ToListAsync()`. Renamed to `Greenhouses`, with
  `.ToTable("Greenhouse")` so the database table name doesn't change.
- **`farmController.cs`** — lowercase filename, inconsistent with the rest.
- **Your JWT key lives in `appsettings.json`**, which is committed to GitHub.
  Move it: `dotnet user-secrets set "Jwt:Key" "..."`. Rotate the current one,
  it should be considered compromised.

## 9. Git: you have an unfinished merge

`.git/MERGE_HEAD` and `.git/MERGE_MSG` are present, listing conflicts in
`Controllers/AuthController.cs` and `Models/User.cs`. There are no conflict
markers left in the files, so you resolved them — but never committed. Run
`git status`, check the result is what you want, then `git commit`. Until you
do, the repository is stuck mid-merge.

Also: `bin/`, `obj/` and `.vs/` are in the zip, and `bin/` contains both a
`net8.0` and a `net9.0` folder from an earlier retarget. Check your
`.gitignore` covers them.

---

## Applying these

Copy the files in `fixes/` over yours, matching the folder names. Then:

```bash
# the model changed, so you need a migration
dotnet ef migrations add FixUserFarmRelationships
dotnet ef database update
```

That migration will add a real foreign key on `Users.FarmId`. **It will fail
if any existing row has a `FarmId` that doesn't match a real farm** — which is
possible, since nothing was enforcing it. Check first:

```sql
SELECT Id, Name, Email, FarmId FROM Users
WHERE FarmId IS NOT NULL
  AND FarmId NOT IN (SELECT Id FROM Farms);
```

Fix or null out anything that comes back before running the migration.

`AuthController.Register.cs` is a replacement method, not a whole file —
paste it over your existing `Register`.

## Next: Step 5

Build clock in / clock out before Crop or Livestock. The guide is right that
everything hangs off it — every treatment, feed and harvest log points at an
open shift, which is what makes the daily report free rather than something
you have to reconstruct later. The reference implementation I sent earlier has
a `ShiftService` you can adapt; the only change needed is `int` user ids
instead of Identity's strings.
