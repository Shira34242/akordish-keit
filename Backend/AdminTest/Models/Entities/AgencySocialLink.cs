using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class AgencySocialLink
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; } = string.Empty;

    public virtual Agency Agency { get; set; } = null!;
}
