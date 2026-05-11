namespace AkordishKeit.Models.Exceptions;

public class DailyLimitExceededException : Exception
{
    public int DailyViewCount { get; set; }
    public int DailyLimit { get; set; }
    public string? TagHebrew { get; set; }

    public DailyLimitExceededException(int dailyViewCount, int dailyLimit, string? tagHebrew = null)
        : base($"Daily song view limit exceeded: {dailyViewCount}/{dailyLimit}")
    {
        DailyViewCount = dailyViewCount;
        DailyLimit = dailyLimit;
        TagHebrew = tagHebrew;
    }
}
