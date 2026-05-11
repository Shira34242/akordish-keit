namespace AkordishKeit.Models.DTOs;

public class DailyLimitStatusDto
{
    public bool LimitExceeded { get; set; }
    public int DailyViewCount { get; set; }
    public int DailyLimit { get; set; }
    public int RemainingViews { get; set; }
    public string? TagHebrew { get; set; }
}
