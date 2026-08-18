namespace AkordishKeit.Models.Entities;

/// <summary>
/// Current reward balance. The complete, auditable history is stored in UserRewardTransactions.
/// </summary>
public class UserRewardWallet
{
    public int UserId { get; set; }
    public int CoinBalance { get; set; }
    public int AwardedContentCount { get; set; }
    public DateTime? LegacyConvertedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<UserRewardTransaction> Transactions { get; set; } = new List<UserRewardTransaction>();
}
