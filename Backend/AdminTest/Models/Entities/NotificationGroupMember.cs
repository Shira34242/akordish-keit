namespace AkordishKeit.Models.Entities;

public class NotificationGroupMember
{
    public int NotificationGroupId { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual NotificationGroup NotificationGroup { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
