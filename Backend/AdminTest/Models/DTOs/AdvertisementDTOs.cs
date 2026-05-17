using AkordishKeit.Models.Enums;

namespace AkordishKeit.Models.DTOs;

// =============== Client DTOs ===============

public class ClientDto
{
    public int Id { get; set; }
    public string BusinessName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Statistics
    public int TotalCampaigns { get; set; }
    public int ActiveCampaigns { get; set; }
    public decimal TotalBudget { get; set; }
}

public class CreateClientDto
{
    public string BusinessName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
}

public class UpdateClientDto
{
    public string BusinessName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; }
}

// =============== AdSpot DTOs ===============

public class AdSpotDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TechnicalId { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int RotationIntervalMs { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }

    // Statistics
    public int TotalCampaigns { get; set; }
    public int ActiveCampaigns { get; set; }
    public decimal TotalRevenue { get; set; }
    public string Availability { get; set; } = string.Empty; // "Available", "Occupied", "Scheduled"
    public DateTime? NextAvailableDate { get; set; }
}

public class CreateAdSpotDto
{
    public string Name { get; set; } = string.Empty;
    public string TechnicalId { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public int RotationIntervalMs { get; set; } = 30000;
    public string? Description { get; set; }
}

public class UpdateAdSpotDto
{
    public string Name { get; set; } = string.Empty;
    public string TechnicalId { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int RotationIntervalMs { get; set; }
    public string? Description { get; set; }
}

// =============== AdCampaign DTOs ===============

public class AdCampaignDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int AdSpotId { get; set; }
    public string AdSpotName { get; set; } = string.Empty;
    public int ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string? KnownUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public int Priority { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Budget { get; set; }
    public int ViewCount { get; set; }
    public int ClickCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Computed
    public int DaysRemaining { get; set; }
    public double ClickThroughRate { get; set; }
}

public class CreateAdCampaignDto
{
    public string Name { get; set; } = string.Empty;
    public int AdSpotId { get; set; }
    public int ClientId { get; set; }
    public string? KnownUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public int Priority { get; set; }
    public AdCampaignStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Budget { get; set; }
}

public class UpdateAdCampaignDto
{
    public string Name { get; set; } = string.Empty;
    public int AdSpotId { get; set; }
    public int ClientId { get; set; }
    public string? KnownUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public int Priority { get; set; }
    public AdCampaignStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Budget { get; set; }
}

// =============== Statistics DTOs ===============

public class AdCampaignStatsDto
{
    public int TotalCampaigns { get; set; }
    public int ActiveCampaigns { get; set; }
    public decimal TotalRevenue { get; set; }
    public int TotalClicks { get; set; }
    public int TotalViews { get; set; }
    public double AverageClickThroughRate { get; set; }
}
