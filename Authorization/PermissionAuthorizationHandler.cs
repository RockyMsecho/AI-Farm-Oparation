using Microsoft.AspNetCore.Authorization;

namespace FarmManagement.API.Authorization
{
    /// <summary>
    /// The Handler - runs for every request against an endpoint that requires
    /// a PermissionRequirement. It checks the "permission" claims baked into
    /// the JWT at login (see TokenService/AuthController) rather than hitting
    /// the database, so an authorization check costs nothing extra per
    /// request.
    ///
    /// The trade-off: permissions are frozen into the token at login time. If
    /// you change a role's permissions, anyone already logged in keeps their
    /// old permission set until their token expires (your tokens last 1 hour)
    /// or they log in again. For a farm-management app that's a fine
    /// trade-off; if you ever need instant revocation, you'd check the
    /// database here instead, at the cost of a query per request.
    /// </summary>
    public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
    {
        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            PermissionRequirement requirement)
        {
            var hasPermission = context.User.Claims
                .Any(c => c.Type == "permission" && c.Value == requirement.Permission);

            if (hasPermission)
                context.Succeed(requirement);

            return Task.CompletedTask;
        }
    }
}
