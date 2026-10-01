-- ============================================================================
-- Run this AFTER `dotnet ef database update` for the AddRbac migration has
-- created the Roles/Permissions/RolePermissions tables and the (nullable)
-- Users.RoleId column, but BEFORE you make RoleId non-nullable and drop the
-- old Role string column.
--
-- If this is still a dev database with only your seeded test accounts, it's
-- simplest to just delete the rows and re-register/re-create them instead of
-- running this. This script is for anyone with real user data already in
-- place.
-- ============================================================================

UPDATE Users
SET RoleId = (SELECT Id FROM Roles WHERE Roles.Name = Users.Role)
WHERE RoleId IS NULL OR RoleId = 0;

-- Sanity check - this should return zero rows before you proceed.
-- Anything it does return has a Role string that doesn't match any seeded
-- Role.Name (a typo, most likely) and needs fixing by hand first.
SELECT Id, Name, Email, Role AS OldRoleString
FROM Users
WHERE RoleId IS NULL OR RoleId = 0;
