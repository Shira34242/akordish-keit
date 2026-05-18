using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Security.Claims;

namespace AkordishKeit.Authorization;

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var hasPermission = context.User.Claims
            .Any(claim =>
                string.Equals(claim.Type, "permission", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(claim.Value, requirement.Permission, StringComparison.OrdinalIgnoreCase));

        if (hasPermission)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
