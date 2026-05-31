namespace AkordishKeit.Models.Entities;

public class AdBlockCheck
{
    public int Id { get; set; }
    public bool Detected { get; set; }
    public string? PagePath { get; set; }
    public string? DeviceType { get; set; }
    public int? UserId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CheckedAt { get; set; }

    public virtual User? User { get; set; }
}
