using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace AkordishKeit.Services;

public class ReferralService : IReferralService
{
    private readonly AkordishKeitDbContext _context;
    private readonly IUserTagService _userTagService;
    private readonly ILogger<ReferralService> _logger;
    private readonly IRewardService _rewardService;

    public ReferralService(
        AkordishKeitDbContext context,
        IUserTagService userTagService,
        ILogger<ReferralService> logger,
        IRewardService rewardService)
    {
        _context = context;
        _userTagService = userTagService;
        _logger = logger;
        _rewardService = rewardService;
    }

    public async Task<ReferralSummaryDto> GetSummaryAsync(int userId, string? requestOrigin)
    {
        var code = await GetOrCreateCodeAsync(userId);
        var joinedCount = await _context.UserReferrals.CountAsync(r => r.ReferrerUserId == userId);
        var googleJoinedCount = await _context.UserReferrals.CountAsync(r => r.ReferrerUserId == userId && r.Source == "google");
        var origin = NormalizeOrigin(requestOrigin);

        return new ReferralSummaryDto
        {
            Code = code,
            ReferralUrl = $"{origin}/?ref={Uri.EscapeDataString(code)}",
            JoinedCount = joinedCount,
            GoogleJoinedCount = googleJoinedCount
        };
    }

    public async Task TryRecordGoogleReferralAsync(string? referralCode, int referredUserId, string? ipAddress, string? userAgent)
    {
        var normalizedCode = NormalizeCode(referralCode);
        if (string.IsNullOrEmpty(normalizedCode))
        {
            return;
        }

        var referralCodeEntity = await _context.UserReferralCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Code == normalizedCode);

        if (referralCodeEntity == null || referralCodeEntity.UserId == referredUserId)
        {
            return;
        }

        var alreadyCounted = await _context.UserReferrals.AnyAsync(r => r.ReferredUserId == referredUserId);
        if (alreadyCounted)
        {
            return;
        }

        var referral = new UserReferral
        {
            ReferrerUserId = referralCodeEntity.UserId,
            ReferredUserId = referredUserId,
            ReferralCode = normalizedCode,
            Source = "google",
            CreatedAt = DateTime.UtcNow,
            IpAddress = Truncate(ipAddress, 64),
            UserAgent = Truncate(userAgent, 512)
        };
        _context.UserReferrals.Add(referral);

        try
        {
            await _context.SaveChangesAsync();
            await _rewardService.RewardReferralSignupAsync(referral.Id);
            await _userTagService.RecalculateTagAsync(referralCodeEntity.UserId);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Referral recording skipped for referred user {ReferredUserId}", referredUserId);
        }
    }

    private async Task<string> GetOrCreateCodeAsync(int userId)
    {
        var existing = await _context.UserReferralCodes.FirstOrDefaultAsync(c => c.UserId == userId);
        if (existing != null)
        {
            return existing.Code;
        }

        for (var attempt = 0; attempt < 8; attempt++)
        {
            var code = $"u{userId:x}{RandomNumberGenerator.GetInt32(0x100000, 0xffffff):x}";
            if (await _context.UserReferralCodes.AnyAsync(c => c.Code == code))
            {
                continue;
            }

            _context.UserReferralCodes.Add(new UserReferralCode
            {
                UserId = userId,
                Code = code,
                CreatedAt = DateTime.UtcNow
            });

            try
            {
                await _context.SaveChangesAsync();
                return code;
            }
            catch (DbUpdateException)
            {
                _context.ChangeTracker.Clear();
            }
        }

        throw new InvalidOperationException("Could not create a unique referral code.");
    }

    private static string NormalizeCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return string.Empty;
        }

        var normalized = new string(code.Trim().Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        return normalized.Length <= 32 ? normalized : normalized[..32];
    }

    private static string NormalizeOrigin(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return string.Empty;
        }

        return origin.Trim().TrimEnd('/');
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        return value.Length <= maxLength ? value : value[..maxLength];
    }
}
