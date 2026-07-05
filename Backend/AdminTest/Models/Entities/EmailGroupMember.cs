namespace AkordishKeit.Models.Entities;

public class EmailGroupMember
{
    public int EmailGroupId { get; set; }
    public int UserId { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public virtual EmailGroup? EmailGroup { get; set; }
    public virtual User? User { get; set; }
}
