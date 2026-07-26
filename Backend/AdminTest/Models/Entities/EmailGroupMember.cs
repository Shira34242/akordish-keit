namespace AkordishKeit.Models.Entities;

public class EmailGroupMember
{
    public int EmailGroupId { get; set; }
    public int SubscriberId { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public virtual EmailGroup? EmailGroup { get; set; }
    public virtual EmailSubscriber? Subscriber { get; set; }
}
