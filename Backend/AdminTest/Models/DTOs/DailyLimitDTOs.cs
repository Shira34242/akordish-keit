namespace AkordishKeit.Models.DTOs;

public class DailyLimitStatusDto
{
    public bool LimitExceeded { get; set; }
    public int DailyViewCount { get; set; }
    public int DailyLimit { get; set; }
    public int RemainingViews { get; set; }
    public string? TagHebrew { get; set; }
}

public class DailyPrintLimitDto
{
    public bool Allowed { get; set; }
    public int Used { get; set; }
    public int Limit { get; set; }
    public int Remaining { get; set; }
}
