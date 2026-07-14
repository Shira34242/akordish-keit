namespace AkordishKeit.Models.DTOs;

public class ReferralSummaryDto
{
    public string Code { get; set; } = string.Empty;
    public string ReferralUrl { get; set; } = string.Empty;
    public int JoinedCount { get; set; }
    public int GoogleJoinedCount { get; set; }
}
