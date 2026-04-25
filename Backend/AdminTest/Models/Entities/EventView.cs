namespace AkordishKeit.Models.Entities;

public class EventView
{
    public int Id { get; set; }
    public int? EventId { get; set; }  // null = צפייה בדף רשימת ההופעות
    public int? UserId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime ViewedAt { get; set; }

    public virtual Event? Event { get; set; }
    public virtual User? User { get; set; }
}
