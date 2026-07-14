using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IReferralService
{
    Task<ReferralSummaryDto> GetSummaryAsync(int userId, string? requestOrigin);
    Task TryRecordGoogleReferralAsync(string? referralCode, int referredUserId, string? ipAddress, string? userAgent);
}
