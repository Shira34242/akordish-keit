namespace AkordishKeit.Models.Enum;

[Flags]
public enum TargetAudience
{
    None = 0,
    Children = 1 << 0,        // 1 - ילדים (גילאי 3-12)
    Teenagers = 1 << 1,       // 2 - נוער (גילאי 13-18)
    Adults = 1 << 2,          // 4 - מבוגרים (18+)
    Seniors = 1 << 3,         // 8 - גיל הזהב (60+)
    Beginners = 1 << 4,       // 16 - מתחילים
    Intermediate = 1 << 5,    // 32 - רמה בינונית
    Advanced = 1 << 6,        // 64 - מתקדמים
    Professional = 1 << 7     // 128 - מקצועיים
}
