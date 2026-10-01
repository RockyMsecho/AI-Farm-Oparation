using Microsoft.AspNetCore.Authorization;

namespace FarmManagement.API.Authorization
{
    /// <summary>
    /// ASP.NET Core's authorization system works in three pieces: a
    /// Requirement (what needs to be true), a Handler (how to check it), and a
    /// Policy (a named bundle of requirements). This is the Requirement - it
    /// just carries the permission name.
    /// </summary>
    public class PermissionRequirement : IAuthorizationRequirement
    {
        public string Permission { get; }

        public PermissionRequirement(string permission)
        {
            Permission = permission;
        }
    }
}
