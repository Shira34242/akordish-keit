namespace AkordishKeit.Models.Entities;

public class Client
{
    public int Id { get; set; }
    public string BusinessName { get; set; }
    public string ContactPerson { get; set; }
    public string Email { get; set; }
    public string Phone { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    // Navigation Properties
    public virtual User? CreatedByUser { get; set; }
    public virtual User? UpdatedByUser { get; set; }
    public virtual ICollection<AdCampaign> Campaigns { get; set; }
}
