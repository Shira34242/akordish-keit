using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AkordishKeit.Models.Entities
{
    public class PodcastEpisodeView
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PodcastEpisodeId { get; set; }

        [ForeignKey(nameof(PodcastEpisodeId))]
        public PodcastEpisode PodcastEpisode { get; set; } = null!;

        public int? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User? User { get; set; }

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        [Required]
        public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(500)]
        public string? Referrer { get; set; }
    }
}
