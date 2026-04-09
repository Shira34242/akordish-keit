namespace AkordishKeit.Models.Enum;

/// <summary>
/// תג תרומת תוכן — מוענק למשתמש לפי כמות התכנים שהעלה.
/// מתאפס כל 4 חודשים אם לא הועלה תוכן חדש.
/// </summary>
public enum UserContentTag
{
    None        = 0,   // משתמש רשום ללא העלאות
    Beginner    = 1,   // מתחיל   — 1–4 העלאות
    Contributor = 2,   // תורם    — 5–19 העלאות
    LeadingContributor = 3  // תורם מוביל — 20+ העלאות
}
