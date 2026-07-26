namespace AkordishKeit.Models.Entities;

public class EmailSubscriber
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int? UserId { get; set; }
    public bool IsSubscribed { get; set; } = true;
    public string Source { get; set; } = "admin";
    public DateTime SubscribedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UnsubscribedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual User? User { get; set; }
    public virtual ICollection<EmailGroupMember> Groups { get; set; } = new List<EmailGroupMember>();
}
