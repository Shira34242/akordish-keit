namespace AkordishKeit.Models.Entities;

public class SiteInterestRegistration
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
