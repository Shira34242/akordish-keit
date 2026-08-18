using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class CreateMarketingCampaignRequest
{
    [Required, StringLength(160, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(80, MinimumLength = 2)]
    public string Source { get; set; } = string.Empty;

    [Required, StringLength(500)]
    public string TargetPath { get; set; } = "/";

}

public class UpdateMarketingCampaignStatusRequest
{
    public bool IsActive { get; set; }
}

public class UpdateMarketingCampaignRequest
{
    [Required, StringLength(160, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(80, MinimumLength = 2)]
    public string Source { get; set; } = string.Empty;

    [Required, StringLength(500)]
    public string TargetPath { get; set; } = "/";

}

public class TrackMarketingCampaignVisitRequest
{
    [Required, StringLength(32)]
    public string CampaignCode { get; set; } = string.Empty;

    [Required, StringLength(64)]
    public string VisitorId { get; set; } = string.Empty;

    [StringLength(500)]
    public string? PagePath { get; set; }

    [StringLength(500)]
    public string? Referrer { get; set; }
}

public class MarketingCampaignSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string TargetPath { get; set; } = string.Empty;
    public string TrackingUrl { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int Visits { get; set; }
    public int UniqueVisitors { get; set; }
    public int Signups { get; set; }
    public decimal ConversionRate { get; set; }
    public DateTime? LastVisitAt { get; set; }
}

public class MarketingCampaignDashboardDto
{
    public DateTime DateFrom { get; set; }
    public DateTime DateTo { get; set; }
    public int TotalVisits { get; set; }
    public int UniqueVisitors { get; set; }
    public int TotalSignups { get; set; }
    public decimal ConversionRate { get; set; }
    public List<MarketingCampaignSummaryDto> Campaigns { get; set; } = [];
}
