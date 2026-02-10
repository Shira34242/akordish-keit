namespace AkordishKeit.Models.Enum;

/// <summary>
/// רמת פרופיל מקצועי (Artist או ServiceProvider)
/// </summary>
public enum ProfileTier
{
    /// <summary>
    /// פרופיל חינמי - מוגבל
    /// כולל: שם, תמונה, תיאור קצר, מיקום, טלפון
    /// מופיע באינדקס וחיפוש ללא הדגשה
    /// </summary>
    Free = 0,

    /// <summary>
    /// פרופיל עם מנוי פעיל - מלא
    /// כולל את כל התכונות: תג מומלץ, קדימות בחיפוש, גלריה, וידאו, המלצות, וכו'
    /// </summary>
    Subscribed = 1
}
