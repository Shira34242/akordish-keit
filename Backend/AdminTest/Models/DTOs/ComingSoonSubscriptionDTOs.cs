namespace AkordishKeit.Models.DTOs;

public class ComingSoonSubscriptionDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
}
