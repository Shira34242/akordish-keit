using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// בוסט - קידום חד-פעמי של פרופיל בעל מקצוע
/// </summary>
public class Boost
{
    /// <summary>
    /// מזהה ייחודי
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// קישור לפרופיל בעל המקצוע
    /// </summary>
    public int ServiceProviderId { get; set; }

    // ════════════════════════════════════
    //          תשלום
    // ════════════════════════════════════

    /// <summary>
    /// מחיר ששולם (בדרך כלל 10₪)
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// מזהה תשלום חיצוני (מספק הסליקה)
    /// </summary>
    public string? ExternalPaymentId { get; set; }

    // ════════════════════════════════════
    //          פרטי הבוסט
    // ════════════════════════════════════

    /// <summary>
    /// סוג הבוסט (ראש רשימה / באנר)
    /// </summary>
    public BoostType Type { get; set; }

    /// <summary>
    /// תאריך רכישת הבוסט
    /// </summary>
    public DateTime PurchaseDate { get; set; }

    /// <summary>
    /// תאריך התחלת הפעילות
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// תאריך תפוגה (null = עד שמישהו אחר קונה בוסט)
    /// </summary>
    public DateTime? ExpiryDate { get; set; }

    /// <summary>
    /// האם הבוסט פעיל כרגע
    /// </summary>
    public bool IsActive { get; set; }

    // ════════════════════════════════════
    //          Navigation Properties
    // ════════════════════════════════════

    /// <summary>
    /// בעל המקצוע שרכש את הבוסט
    /// </summary>
    public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;
}
