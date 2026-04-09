namespace AkordishKeit.Models.Entities;

/// <summary>
/// הגדרת מערכת — key/value לשליטה בפיצ'רים ובהגבלות.
/// </summary>
public class SystemSetting
{
    public int Id { get; set; }

    /// <summary>מפתח ייחודי, למשל "regular_user_subscriptions_enabled"</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>ערך כ-string. בוליאני: "true" / "false"</summary>
    public string Value { get; set; } = string.Empty;

    /// <summary>תיאור קריא לאדמין</summary>
    public string Description { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
