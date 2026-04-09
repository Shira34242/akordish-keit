using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class MusicServiceProviderSocialLink
{
    public int Id { get; set; }
    public int ServiceProviderId { get; set; }
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; } = string.Empty;

    public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;
}
