namespace AkordishKeit.Models.Entities;

/// <summary>
/// An immutable credit or debit in a user's reward wallet.
/// </summary>
public class UserRewardTransaction
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserRewardWallet Wallet { get; set; } = null!;
}
