using System;

namespace AkordishKeit.Models.Entities
{
    public class MusicServiceProviderBranch
    {
        public int Id { get; set; }

        public int ServiceProviderId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? Address { get; set; }

        public int? CityId { get; set; }

        public string? ImageUrl { get; set; }

        public string? PhoneNumber { get; set; }

        public string? Email { get; set; }

        public string? OpeningHours { get; set; }

        public int Order { get; set; }

        public DateTime CreatedAt { get; set; }

        public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;
    }
}
