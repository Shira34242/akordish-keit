using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IMarketingCampaignService
{
    Task<MarketingCampaignDashboardDto> GetDashboardAsync(DateTime? dateFrom, DateTime? dateTo, string frontendBaseUrl, string backendBaseUrl);
    Task<MarketingCampaignSummaryDto> CreateAsync(CreateMarketingCampaignRequest request, int createdByUserId, string frontendBaseUrl, string backendBaseUrl);
    Task<MarketingCampaignSummaryDto?> UpdateAsync(int id, UpdateMarketingCampaignRequest request, string frontendBaseUrl, string backendBaseUrl);
    Task<bool> DeleteAsync(int id);
    Task<bool> SetStatusAsync(int id, bool isActive);
    Task<bool> TrackVisitAsync(TrackMarketingCampaignVisitRequest request, int? userId, string? ipAddress, string? userAgent);
    Task<string?> TrackExternalClickAsync(string campaignCode, string visitorId, string? referrer, string? ipAddress, string? userAgent);
    Task RecordSignupAsync(string? campaignCode, string? visitorId, int userId, string? ipAddress, string? userAgent);
}
