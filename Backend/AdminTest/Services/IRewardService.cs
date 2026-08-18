using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IRewardService
{
    Task EnsureLegacyConversionAsync();
    Task<RewardWalletDto> GetWalletAsync(int userId);
    Task<RewardSpendResultDto> SpendForChordBookAsync(int userId, int playlistId);
    Task SyncContentRewardsAsync(int userId, int approvedContentCount);
    Task RewardReferralSignupAsync(int referralId);
    Task<bool> RefundChordBookAsync(int userId, long transactionId);
    Task RewardReferralActivationAsync(int referredUserId);
    Task RewardReferralContributionAsync(int referredUserId);
}
