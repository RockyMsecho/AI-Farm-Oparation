using Microsoft.AspNetCore.Authorization;

namespace FarmManagement.API.Authorization
{
    /// <summary>
    /// Normally every policy you use in [Authorize(Policy = "...")] has to be
    /// registered up front:
    ///
    ///     builder.Services.AddAuthorization(options =>
    ///         options.AddPolicy("zones.delete", p => p.Requirements.Add(...)));
    ///
    /// With 13 permissions today and more coming in Steps 6-9, that's 13+
    /// lines in Program.cs that have to stay in sync with Common/Permissions.cs
    /// by hand - exactly the kind of duplication that drifts.
    ///
    /// This provider builds the policy on the fly the first time it's asked
    /// for. `[Authorize(Policy = Permissions.ZonesDelete)]` asks for a policy
    /// named "zones.delete" - this class sees a policy name it doesn't
    /// recognize, wraps it in a PermissionRequirement, and hands back a policy
    /// built from that. Nothing needs registering in Program.cs beyond this
    /// provider itself.
    /// </summary>
    public class PermissionPolicyProvider : IAuthorizationPolicyProvider
    {
        private readonly DefaultAuthorizationPolicyProvider _fallback;

        public PermissionPolicyProvider(Microsoft.Extensions.Options.IOptions<AuthorizationOptions> options)
        {
            _fallback = new DefaultAuthorizationPolicyProvider(options);
        }

        public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();

        public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

        public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
        {
            if (!policyName.Contains('.'))
                return _fallback.GetPolicyAsync(policyName);

            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(policyName))
                .Build();

            return Task.FromResult<AuthorizationPolicy?>(policy);
        }
    }
}
