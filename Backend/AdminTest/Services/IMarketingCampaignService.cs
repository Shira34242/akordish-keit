using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IMarketingCampaignService
{
    Task<MarketingCampaignDashboardDto> GetDashboardAsync(DateTime? dateFrom, DateTime? dateTo, string frontendBaseUrl);
    Task<MarketingCampaignSummaryDto> CreateAsync(CreateMarketingCampaignRequest request, int createdByUserId, string frontendBaseUrl);
    Task<MarketingCampaignSummaryDto?> UpdateAsync(int id, UpdateMarketingCampaignRequest request, string frontendBaseUrl);
    Task<bool> DeleteAsync(int id);
    Task<bool> SetStatusAsync(int id, bool isActive);
    Task<MarketingCampaignRedirectDto?> ResolveAsync(string code);
    Task<bool> TrackVisitAsync(TrackMarketingCampaignVisitRequest request, int? userId, string? ipAddress, string? userAgent);
    Task RecordSignupAsync(string? campaignCode, string? visitorId, int userId, string? ipAddress, string? userAgent);
}
