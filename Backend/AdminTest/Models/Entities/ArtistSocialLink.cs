using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class ArtistSocialLink
{
    public int Id { get; set; }
    public int ArtistId { get; set; }
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; }

    // Navigation Properties
    public virtual Artist Artist { get; set; }
}