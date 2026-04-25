namespace AkordishKeit.Models.Entities;

public class ButtonClick
{
    public int Id { get; set; }

    /// <summary>
    /// סוג הלחצן: "ticket" | "contact" | "notification_link"
    /// </summary>
    public string ButtonType { get; set; } = string.Empty;

    /// <summary>
    /// מזהה הפריט הקשור: מזהה הופעה עבור ticket, מזהה התראה עבור notification_link
    /// </summary>
    public int? ItemId { get; set; }

    /// <summary>
    /// תווית לתצוגה (שם הופעה, כותרת התראה וכד׳)
    /// </summary>
    public string? ItemLabel { get; set; }

    public int? UserId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime ClickedAt { get; set; }

    public virtual User? User { get; set; }
}
