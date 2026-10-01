# Permission-based RBAC

Replaces `[Authorize(Roles = "Owner,Manager")]` role-string checks with
`[Authorize(Policy = Permissions.ZonesDelete)]` permission checks, built on
top of the Farm/Zone/Auth fixes and the Step 5 Shift addition you already
have. Same `int`-id, hand-rolled-JWT project - no ASP.NET Identity.

## Why this is worth the extra tables

Right now, adding a new role means re-reading every controller to find every
`Authorize(Roles = "...")` list it should be added to. With permissions, you
add one row to the matrix in `RbacSeeder.cs` and every endpoint that checks
`"zones.view"` respects it immediately - no controller changes. This starts
paying off the moment you build Step 6/7/8: an "Agronomist" who should be
able to log treatments but not create zones is one seed-matrix line, not a
hunt through five controllers.

## How the pieces fit together

```
JWT login
   |
   v
claims: sub, email, role="Manager", permission="zones.view",
        permission="zones.create", permission="zones.update", ...
   |
   v
[Authorize(Policy = "zones.delete")] on an endpoint
   |
   v
PermissionPolicyProvider sees "zones.delete" isn't a registered policy name,
builds one on the fly wrapping a PermissionRequirement("zones.delete")
   |
   v
PermissionAuthorizationHandler checks: does this token have a
"permission" claim equal to "zones.delete"? Yes -> Succeed. No -> 403.
```

Nothing hits the database per request - the permission list is frozen into
the token at login (1-hour expiry, same as before). If you change a role's
permissions, anyone already logged in keeps the old set until their token
expires or they log in again. Fine for this project; if you ever need
instant revocation, `PermissionAuthorizationHandler` would need to query the
database instead of reading the claim, at the cost of a query per request.

## Files

| File | Goes to |
|---|---|
| `Common/Permissions.cs` | `Common/Permissions.cs` (new) |
| `Common/CurrentUserExtensions.cs` | replaces your existing one |
| `Models/Role.cs`, `Models/Permission.cs` | `Models/` (new) |
| `Models/User.cs` | replaces your existing one |
| `Data/ApplicationDbContext.cs` | replaces your existing one (includes the Farm-relationship fix from before, plus Shift, plus RBAC) |
| `Data/RbacSeeder.cs` | `Data/` (new) |
| `Authorization/*.cs` | `Authorization/` (new folder) |
| `Controllers/AuthController.cs` | replaces your existing one |
| `Controllers/UserController.cs` | replaces your existing one |
| `Controllers/ZoneController.cs` | replaces your existing one |
| `Controllers/GreenhouseController.cs` | replaces your existing one |
| `Controllers/FarmController.cs` | replaces your existing one - also fixes the cross-farm `GetFarm(id)` leak flagged in the earlier review, since it needed the same policy conversion anyway |
| `Program.diff.cs` | two additions to your `Program.cs` - not a file to copy wholesale |
| `migrate-existing-roles.sql` | run once, only if you have real (non-test) user data already |

`Roles.cs` (constants for role *names*) is unchanged from the earlier fix -
still needed for the seed matrix and the handful of rules that check role
identity rather than permission.

## The default permission matrix

| Permission | Owner | Manager | Worker / Agronomist / Technician |
|---|:---:|:---:|:---:|
| users.view | Y | Y | |
| users.create | Y | Y | |
| users.updateRole | Y | Y | |
| users.updateStatus | Y | Y | |
| farms.create | Y | Y | |
| farms.view | Y | Y | Y |
| greenhouses.create | Y | Y | |
| greenhouses.view | Y | Y | Y |
| zones.create | Y | Y | |
| zones.view | Y | Y | Y |
| zones.update | Y | Y | |
| zones.delete | Y | | |
| shifts.manage | Y | Y | Y |

This is exactly the behaviour your project already had after the earlier
review fixes - nothing here changes what any role can do today. What changes
is that it's now one table to edit instead of an `Authorize(Roles = ...)`
hunt across controllers.

Business rules that stayed as role-name checks, because a permission can't
express them:
- A Manager can't promote another user to Manager, or demote a Manager.
- The Owner role can't be reassigned to anyone, and the Owner account can't
  be deactivated.
- You can't change your own role or deactivate your own account.

## Setting it up

```bash
# 1. Copy the files per the table above.
# 2. Apply the two Program.cs additions from Program.diff.cs.

dotnet ef migrations add AddRbac
dotnet ef database update
```

If you have real user data already (not just test accounts), read
`migrate-existing-roles.sql` before applying the migration that removes the
old `Role` string column - it copies each user's old role name into the new
`RoleId` based on the seeded roles. If this is still a dev database, simpler
to just delete the test users and re-register.

## Trying it

Register, log in as the new Owner, then hit `GET /api/user` (works, Owner has
`users.view`). Create a Worker account through `POST /api/user`, log in as
that Worker, and try `POST /api/zone` - you should get a 403, because Workers
only have `zones.view`. Try `GET /api/zone` as the same Worker - that one
should succeed.

## What Step 6 will need from this

When you build Crop tracking, decide which permissions a treatment/harvest
log needs - most likely a new `crops.log` permission given to Worker,
Agronomist and Technician (the guide's "3-field form" is meant for staff, not
just Owner/Manager), plus `crops.viewPlans` for reading crop plans. Add the
permission name to `Permissions.cs`, add it to the relevant roles in
`RbacSeeder`'s matrix, and the controller just needs
`[Authorize(Policy = Permissions.CropsLog)]` - no other wiring required,
which is the entire point of building this now rather than after Steps 6-9
are done.
