namespace AkordishKeit.Models.Entities;

public class UserReferral
{
    public int Id { get; set; }
    public int ReferrerUserId { get; set; }
    public int ReferredUserId { get; set; }
    public string ReferralCode { get; set; } = string.Empty;
    public string Source { get; set; } = "google";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public User ReferrerUser { get; set; } = null!;
    public User ReferredUser { get; set; } = null!;
}
