using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[ApiController]
[Authorize]
[Route("api/rewards")]
public class RewardsController : ControllerBase
{
    private readonly IRewardService _rewardService;
    private readonly ISystemSettingsService _settingsService;
    public RewardsController(IRewardService rewardService, ISystemSettingsService settingsService)
    {
        _rewardService = rewardService;
        _settingsService = settingsService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<RewardWalletDto>> GetMyWallet()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        var role = User.FindFirstValue(ClaimTypes.Role);
        var isManager = Enum.TryParse<UserRole>(role, out var parsedRole) && parsedRole >= UserRole.Manager;
        var isAvailable = isManager || await _settingsService.GetBoolAsync(SystemSettingsController.RewardsVisibleToMembersKey);
        if (!isAvailable)
            return Ok(new RewardWalletDto { IsAvailable = false });

        var wallet = await _rewardService.GetWalletAsync(userId);
        wallet.IsAvailable = true;
        return Ok(wallet);
    }

    [HttpPost("chord-book-refund/{transactionId:long}")]
    public async Task<ActionResult> RefundChordBook(long transactionId)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        return Ok(new { success = await _rewardService.RefundChordBookAsync(userId, transactionId) });
    }
}
