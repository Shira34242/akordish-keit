namespace AkordishKeit.Models.DTOs;

public class RewardWalletDto
{
    public bool IsAvailable { get; set; }
    public int CoinBalance { get; set; }
    public int ChordBookCost { get; set; }
    public List<RewardTransactionDto> Transactions { get; set; } = new();
}

public class RewardTransactionDto
{
    public long Id { get; set; }
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RewardSpendResultDto
{
    public bool Success { get; set; }
    public int Cost { get; set; }
    public int Balance { get; set; }
    public long? TransactionId { get; set; }
    public string? Message { get; set; }
}
