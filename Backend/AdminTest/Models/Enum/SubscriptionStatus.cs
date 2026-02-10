namespace AkordishKeit.Models.Enum;

/// <summary>
/// סטטוס מנוי
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>
    /// ממתין לתשלום - לא פעיל
    /// </summary>
    PendingPayment = 0,

    /// <summary>
    /// מנוי ניסיון - 2 חודשים חינם
    /// </summary>
    Trial = 1,

    /// <summary>
    /// מנוי פעיל - משלם
    /// </summary>
    Active = 2,

    /// <summary>
    /// מנוי בוטל - ימשיך עד סוף התקופה ששולמה
    /// </summary>
    Cancelled = 3,

    /// <summary>
    /// מנוי פג תוקף - לא פעיל
    /// </summary>
    Expired = 4,

    /// <summary>
    /// מנוי מושהה - כשל תשלום או הקפאה
    /// </summary>
    Suspended = 5
}
