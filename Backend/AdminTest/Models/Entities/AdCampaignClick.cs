using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AkordishKeit.Models.Entities
{
    public class AdCampaignClick
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AdCampaignId { get; set; }

        [ForeignKey(nameof(AdCampaignId))]
        public AdCampaign AdCampaign { get; set; } = null!;

        // For logged-in users
        public int? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User? User { get; set; }

        // For guest users
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        [Required]
        public DateTime ClickedAt { get; set; } = DateTime.UtcNow;

        // Optional: Store additional tracking info
        [MaxLength(500)]
        public string? Referrer { get; set; }
    }
}
