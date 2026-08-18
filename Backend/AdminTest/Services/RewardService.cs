using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace AkordishKeit.Services;

public class RewardService : IRewardService
{
    public const int ChordBookCost = 10;
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<RewardService> _logger;

    public RewardService(AkordishKeitDbContext context, ILogger<RewardService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task EnsureLegacyConversionAsync()
    {
        var users = await _context.Users
            .Where(user => !_context.UserRewardWallets.Any(wallet => wallet.UserId == user.Id))
            .Select(user => new { user.Id, user.UploadCount, user.ContentTag, user.ChordBookExportCount, user.Role })
            .ToListAsync();

        foreach (var user in users)
        {
            var referralCount = await _context.UserReferrals.CountAsync(referral => referral.ReferrerUserId == user.Id);
            var legacyBookLimit = user.Role >= UserRole.Manager
                ? 0
                : user.ContentTag switch { UserContentTag.LeadingContributor => 2, UserContentTag.Contributor => 1, _ => 0 };
            var remainingLegacyBooks = Math.Max(0, legacyBookLimit - user.ChordBookExportCount);
            var legacyCoins = Math.Max(Math.Max(0, user.UploadCount), remainingLegacyBooks * ChordBookCost) + referralCount;
            var wallet = new UserRewardWallet
            {
                UserId = user.Id,
                CoinBalance = legacyCoins,
                AwardedContentCount = Math.Max(0, user.UploadCount),
                LegacyConvertedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.UserRewardWallets.Add(wallet);
            _context.UserRewardTransactions.Add(new UserRewardTransaction
            {
                UserId = user.Id,
                Amount = legacyCoins,
                BalanceAfter = legacyCoins,
                ActionType = "legacy_conversion",
                IdempotencyKey = $"legacy-conversion:{user.Id}",
                Description = "המרת נקודות והטבות מהמערכת הקודמת",
                CreatedAt = DateTime.UtcNow
            });
        }

        if (users.Count > 0)
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Converted {UserCount} existing users to reward wallets.", users.Count);
        }
    }

    public async Task<RewardWalletDto> GetWalletAsync(int userId)
    {
        var wallet = await GetOrCreateWalletAsync(userId);
        var transactions = await _context.UserRewardTransactions
            .Where(transaction => transaction.UserId == userId)
            .OrderByDescending(transaction => transaction.Id)
            .Take(20)
            .Select(transaction => new RewardTransactionDto
            {
                Id = transaction.Id,
                Amount = transaction.Amount,
                BalanceAfter = transaction.BalanceAfter,
                ActionType = transaction.ActionType,
                Description = transaction.Description,
                CreatedAt = transaction.CreatedAt
            })
            .ToListAsync();

        return new RewardWalletDto { CoinBalance = wallet.CoinBalance, ChordBookCost = ChordBookCost, Transactions = transactions };
    }

    public async Task<RewardSpendResultDto> SpendForChordBookAsync(int userId, int playlistId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var wallet = await _context.UserRewardWallets.SingleOrDefaultAsync(item => item.UserId == userId);
        if (wallet == null)
        {
            return new RewardSpendResultDto { Success = false, Cost = ChordBookCost, Balance = 0, Message = "הארנק עדיין אינו מוכן. נסה שוב בעוד רגע." };
        }

        if (wallet.CoinBalance < ChordBookCost)
        {
            return new RewardSpendResultDto { Success = false, Cost = ChordBookCost, Balance = wallet.CoinBalance, Message = "אין מספיק מטבעות ליצירת ספר אקורדים." };
        }

        wallet.CoinBalance -= ChordBookCost;
        wallet.UpdatedAt = DateTime.UtcNow;
        var debit = new UserRewardTransaction
        {
            UserId = userId,
            Amount = -ChordBookCost,
            BalanceAfter = wallet.CoinBalance,
            ActionType = "chord_book_export",
            IdempotencyKey = $"chord-book:{Guid.NewGuid():N}",
            ReferenceType = "playlist",
            ReferenceId = playlistId,
            Description = "יצירת ספר אקורדים",
            CreatedAt = DateTime.UtcNow
        };
        _context.UserRewardTransactions.Add(debit);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new RewardSpendResultDto { Success = true, Cost = ChordBookCost, Balance = wallet.CoinBalance, TransactionId = debit.Id };
    }

    public async Task<bool> RefundChordBookAsync(int userId, long transactionId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var debit = await _context.UserRewardTransactions.SingleOrDefaultAsync(item => item.Id == transactionId && item.UserId == userId && item.ActionType == "chord_book_export");
        if (debit == null || await _context.UserRewardTransactions.AnyAsync(item => item.IdempotencyKey == $"chord-book-refund:{transactionId}")) return false;
        var wallet = await _context.UserRewardWallets.SingleAsync(item => item.UserId == userId);
        wallet.CoinBalance += -debit.Amount;
        wallet.UpdatedAt = DateTime.UtcNow;
        _context.UserRewardTransactions.Add(new UserRewardTransaction
        {
            UserId = userId, Amount = -debit.Amount, BalanceAfter = wallet.CoinBalance,
            ActionType = "chord_book_refund", IdempotencyKey = $"chord-book-refund:{transactionId}",
            ReferenceType = "reward_transaction", ReferenceId = debit.ReferenceId,
            Description = "החזר מטבעות: הפקת ספר נכשלה", CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    public async Task SyncContentRewardsAsync(int userId, int approvedContentCount)
    {
        var wallet = await GetOrCreateWalletAsync(userId);
        var newlyApproved = Math.Max(0, approvedContentCount - wallet.AwardedContentCount);
        if (newlyApproved == 0) return;

        wallet.AwardedContentCount = approvedContentCount;
        wallet.CoinBalance += newlyApproved;
        wallet.UpdatedAt = DateTime.UtcNow;
        _context.UserRewardTransactions.Add(new UserRewardTransaction
        {
            UserId = userId,
            Amount = newlyApproved,
            BalanceAfter = wallet.CoinBalance,
            ActionType = "approved_content",
            IdempotencyKey = $"approved-content:{userId}:{approvedContentCount}",
            Description = "תוכן שאושר",
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        await RewardReferralContributionAsync(userId);
    }

    public async Task RewardReferralSignupAsync(int referralId)
    {
        var referral = await _context.UserReferrals.FindAsync(referralId);
        if (referral == null) return;
        var wallet = await GetOrCreateWalletAsync(referral.ReferrerUserId);
        var key = $"referral-signup:{referralId}";
        if (await _context.UserRewardTransactions.AnyAsync(item => item.IdempotencyKey == key)) return;

        wallet.CoinBalance++;
        wallet.UpdatedAt = DateTime.UtcNow;
        _context.UserRewardTransactions.Add(new UserRewardTransaction
        {
            UserId = referral.ReferrerUserId,
            Amount = 1,
            BalanceAfter = wallet.CoinBalance,
            ActionType = "referral_signup",
            IdempotencyKey = key,
            ReferenceType = "referral",
            ReferenceId = referral.Id,
            Description = "חבר שהצטרף דרך הקישור שלך",
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
    }

    public async Task RewardReferralActivationAsync(int referredUserId)
    {
        var referral = await _context.UserReferrals.SingleOrDefaultAsync(item => item.ReferredUserId == referredUserId);
        if (referral == null || referral.ActivationRewardedAt.HasValue || DateTime.UtcNow <= referral.CreatedAt.AddMinutes(5)) return;
        await RewardReferralAsync(referral, "activation", "חבר שחזר והשתמש באתר", item => item.ActivationRewardedAt = DateTime.UtcNow);
    }

    public async Task RewardReferralContributionAsync(int referredUserId)
    {
        var referral = await _context.UserReferrals.SingleOrDefaultAsync(item => item.ReferredUserId == referredUserId);
        if (referral == null || referral.ContributionRewardedAt.HasValue) return;
        await RewardReferralAsync(referral, "contribution", "חבר שתרם תוכן שאושר", item => item.ContributionRewardedAt = DateTime.UtcNow);
    }

    private async Task RewardReferralAsync(UserReferral referral, string phase, string description, Action<UserReferral> markComplete)
    {
        var key = $"referral-{phase}:{referral.Id}";
        if (await _context.UserRewardTransactions.AnyAsync(item => item.IdempotencyKey == key)) return;
        var wallet = await GetOrCreateWalletAsync(referral.ReferrerUserId);
        wallet.CoinBalance++;
        wallet.UpdatedAt = DateTime.UtcNow;
        markComplete(referral);
        _context.UserRewardTransactions.Add(new UserRewardTransaction
        {
            UserId = referral.ReferrerUserId,
            Amount = 1,
            BalanceAfter = wallet.CoinBalance,
            ActionType = $"referral_{phase}",
            IdempotencyKey = key,
            ReferenceType = "referral",
            ReferenceId = referral.Id,
            Description = description,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
    }

    private async Task<UserRewardWallet> GetOrCreateWalletAsync(int userId)
    {
        var wallet = await _context.UserRewardWallets.SingleOrDefaultAsync(item => item.UserId == userId);
        if (wallet != null) return wallet;

        wallet = new UserRewardWallet { UserId = userId, UpdatedAt = DateTime.UtcNow };
        _context.UserRewardWallets.Add(wallet);
        await _context.SaveChangesAsync();
        return wallet;
    }
}
