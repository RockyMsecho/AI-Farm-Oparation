# FarmManagement.API — reviewed & extended

This is your project with three rounds of changes applied on top of each
other. Read `docs/` in order — each file explains one round.

| Doc | Covers |
|---|---|
| `docs/01-CODE-REVIEW.md` | Fixes to Steps 1–4 (Auth, Farm, Greenhouse, Zone, User) — the missing `SaveChangesAsync`, the broken `User↔Farm` relationship, unscoped Zone/Greenhouse endpoints, open registration |
| `docs/02-STEP5-SHIFTS.md` | Step 5 — Clock In / Clock Out, added fresh (didn't exist in your upload) |
| `docs/03-RBAC.md` | Full permission-based authorization, replacing `[Authorize(Roles = "...")]` everywhere with `[Authorize(Policy = Permissions.X)]` |

## ⚠️ Your `Migrations/` folder is not in this zip — on purpose

Comparing this checkout against your upload: every tracked file matches
except one thing — **your `Migrations/` folder isn't in your GitHub repo.**
It only exists locally on your machine (which lines up with the unfinished
merge sitting in your `.git` — see `docs/01-CODE-REVIEW.md` §9). Since I don't
have your real migration history, generating one here would create a
duplicate `InitialCreate` that conflicts with the one your actual database
already ran.

**Do this instead:** copy every file below into your real local project
(which still has its `Migrations/` folder untouched), then run the EF
commands there. EF will diff against your existing migrations correctly.

Commit `Migrations/` to git after this — an EF Core project without its
migration history in version control means anyone else who clones the repo
can't build the database at all.

## What's in this zip

Everything compiles as a complete project — copy the whole thing over your
local folder (except `Migrations/`, which isn't here and shouldn't be
touched) or copy file-by-file if you'd rather review each change first.

```
Authorization/                  new - permission policy plumbing (RBAC)
Common/
  CurrentUserExtensions.cs      updated - now includes Role on every load
  Permissions.cs                new - permission name constants
  Roles.cs                      unchanged from the code-review fix
Controllers/
  AuthController.cs             updated - transactional register, permission claims in JWT
  FarmController.cs             updated - policy-based, fixes the GetFarm(id) cross-farm leak
  GreenhouseController.cs       updated - policy-based, farm-scoped
  ShiftsController.cs           new - Step 5
  UserController.cs             updated - policy-based, the missing SaveChangesAsync fix
  ZoneController.cs             updated - policy-based, farm-scoped
Data/
  ApplicationDbContext.cs       updated - Farm/User relationships fixed, Shift + RBAC tables added
  RbacSeeder.cs                 new - creates default roles/permissions on startup
DTOs/
  ClockRequestDto.cs            new - Step 5
  UpdateUserStatusRequestDto.cs new - replaces a bare bool request body
  (everything else unchanged)
Models/
  Farm.cs                       updated - Members collection added
  Greenhouse.cs                 unchanged
  Permission.cs                 new - RBAC
  Role.cs                       new - RBAC
  Shift.cs                      new - Step 5
  User.cs                       updated - Role string replaced with RoleId FK
  Zone.cs                       unchanged
Program.cs                      updated - RBAC service registration + seeding call
appsettings.json                unchanged (still has your JWT key in plain text - see review §8)
```

## Setup, in order

```bash
# 1. Copy the files above into your real local project.

# 2. Migrate - run this in YOUR project, which still has its migration history.
dotnet ef migrations add AddShiftsAndRbac
dotnet ef database update

# 3. If you have real (non-test) user rows already, read
#    docs/migrate-existing-roles.sql before the migration finishes -
#    it maps each user's old Role string onto the new RoleId.
#    If this is still just dev/test data, simpler to delete those rows
#    and re-register.

# 4. Run it.
dotnet run
```

## Quick smoke test

```
POST /api/auth/register        -> creates an Owner + their farm
POST /api/auth/management-login -> get a token
POST /api/shifts/clock-in       -> Step 5
POST /api/user                  -> create a Worker (Owner has users.create)
                                    log in as that Worker
POST /api/zone                  -> should 403 - Workers only have zones.view
GET  /api/zone                  -> should succeed
```

## What's still not built (Steps 6–11)

Crop tracking, Livestock, Inventory, the two dashboards, and offline support
don't exist in your project yet. The permission matrix in
`docs/03-RBAC.md` has a worked example of what adding Step 6 (Crop) will
need — one new permission, one line in the seed matrix, one `[Authorize]`
attribute.


## Local login fix

For the most reliable development setup, start the backend with `START-AI-FARM.ps1` and open:
`https://localhost:5226/auth.html`

The frontend is now served by ASP.NET Core from the same HTTPS origin as the API. This avoids the `file://` -> `https://localhost:5226` browser connection problem that can appear after signing out and trying to log in again.

If the browser does not trust the certificate, run `TRUST-HTTPS-CERTIFICATE.ps1` once.
