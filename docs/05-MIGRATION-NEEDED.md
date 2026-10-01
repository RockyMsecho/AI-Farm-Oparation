# A fresh migration is required before this will run

## What happened

`Models/FieldReport.cs` and `Controllers/ReportsController.cs` were added
after the last migration (`20260920062022_InitialCreate`) was generated.
The `DbContext` and the migration have drifted apart: `ApplicationDbContext`
knows about `FieldReports`, but the actual database schema the old migration
describes does not have that table. Run this as-is and the moment anything
calls `GET/POST /api/Reports`, `GET /api/Shifts/team`, or anything else that
touches `FieldReports`, it fails with a SQL error - `Invalid object name
'FieldReports'`.

## Why the old migration was deleted instead of patched

I could have hand-written a new migration file that only adds the
`FieldReports` table, without touching your existing data. I didn't, on
purpose: a hand-written migration has to match, byte-for-byte, what EF's own
snapshot mechanism expects internally. Get one column's nullability or one
index's naming convention slightly wrong, and it won't fail immediately - it
fails confusingly, later, the next time you run `dotnet ef migrations add`
for something unrelated, producing a diff full of changes that have nothing
to do with what you just did. That's a much worse problem to hand a beginner
than "delete your dev database and start over."

If this were a project with real production data at stake, patching in place
would be worth the care it takes to get right. For a project you're actively
registering test accounts against, regenerating clean is the safer call.

## What to do

```bash
cd backend

# 1. Drop the existing (already out-of-date) local database.
dotnet ef database drop --force

# 2. Generate one fresh migration reflecting the complete current model -
#    Users, Farms, Greenhouses, Zones, Shifts, Roles, Permissions, and now
#    FieldReports, all in one InitialCreate.
dotnet ef migrations add InitialCreate

# 3. Apply it.
dotnet ef database update

# 4. Run the API. RbacSeeder creates the roles, permissions, and role-
#    permission links automatically on startup, same as before.
dotnet run
```

You'll need to register a new Owner account afterward - dropping the
database means the one you had before is gone. That's expected.

## After this

The `Migrations/` folder will only contain what `dotnet ef migrations add`
generates - don't hand-edit anything in there. If you add another model or
change an existing one in the future, the normal flow is
`dotnet ef migrations add <SomeDescriptiveName>` followed by
`dotnet ef database update`, and it'll build correctly on top of this clean
starting point.
