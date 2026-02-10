using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

/// <summary>
/// שירות לניהול בוסטים (קידומים חד-פעמיים)
/// </summary>
public class BoostService : IBoostService
{
    private readonly AkordishKeitDbContext _context;

    public BoostService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// רכישת בוסט לפרופיל
    /// כאשר בוסט נרכש, הבוסט הפעיל הקודם מאותו סוג מושבת
    /// </summary>
    public async Task<BoostDto> PurchaseBoostAsync(int serviceProviderId, BoostType type, decimal price, string? externalPaymentId)
    {
        // בדיקה שהפרופיל קיים
        var serviceProvider = await _context.ServiceProviders.FindAsync(serviceProviderId);
        if (serviceProvider == null)
        {
            throw new ArgumentException("פרופיל בעל מקצוע לא נמצא");
        }

        // השבתת בוסט פעיל קודם מאותו סוג
        var activeBoost = await GetActiveBoostByTypeAsync(type);
        if (activeBoost != null)
        {
            await DeactivateBoostAsync(activeBoost.Id);
        }

        // יצירת בוסט חדש
        var boost = new Boost
        {
            ServiceProviderId = serviceProviderId,
            Type = type,
            Price = price,
            ExternalPaymentId = externalPaymentId,
            PurchaseDate = DateTime.UtcNow,
            StartDate = DateTime.UtcNow,
            IsActive = true,
            // ExpiryDate = null (פעיל עד שמישהו אחר קונה)
        };

        _context.Boosts.Add(boost);
        await _context.SaveChangesAsync();

        return MapToDto(boost);
    }

    /// <summary>
    /// קבלת בוסט פעיל לפי סוג
    /// </summary>
    public async Task<BoostDto?> GetActiveBoostByTypeAsync(BoostType type)
    {
        var boost = await _context.Boosts
            .Where(b => b.Type == type && b.IsActive)
            .OrderByDescending(b => b.PurchaseDate)
            .FirstOrDefaultAsync();

        return boost == null ? null : MapToDto(boost);
    }

    /// <summary>
    /// קבלת כל הבוסטים של פרופיל
    /// </summary>
    public async Task<List<BoostDto>> GetProfileBoostsAsync(int serviceProviderId)
    {
        var boosts = await _context.Boosts
            .Where(b => b.ServiceProviderId == serviceProviderId)
            .OrderByDescending(b => b.PurchaseDate)
            .ToListAsync();

        return boosts.Select(MapToDto).ToList();
    }

    /// <summary>
    /// השבתת בוסט (כאשר בוסט חדש נרכש)
    /// </summary>
    public async Task DeactivateBoostAsync(int boostId)
    {
        var boost = await _context.Boosts.FindAsync(boostId);
        if (boost == null)
        {
            throw new ArgumentException("בוסט לא נמצא");
        }

        boost.IsActive = false;
        boost.ExpiryDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// ניקוי בוסטים ישנים שאינם פעילים (תחזוקה)
    /// </summary>
    public async Task CleanupOldBoostsAsync(int daysOld = 30)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-daysOld);

        var oldBoosts = await _context.Boosts
            .Where(b => !b.IsActive &&
                       b.ExpiryDate.HasValue &&
                       b.ExpiryDate.Value < cutoffDate)
            .ToListAsync();

        if (oldBoosts.Any())
        {
            _context.Boosts.RemoveRange(oldBoosts);
            await _context.SaveChangesAsync();
        }
    }

    // ========== Private Helper Methods ==========

    /// <summary>
    /// המרת Entity ל-DTO
    /// </summary>
    private BoostDto MapToDto(Boost boost)
    {
        return new BoostDto
        {
            Id = boost.Id,
            ServiceProviderId = boost.ServiceProviderId,
            Price = boost.Price,
            ExternalPaymentId = boost.ExternalPaymentId,
            Type = boost.Type,
            TypeName = GetBoostTypeName(boost.Type),
            PurchaseDate = boost.PurchaseDate,
            StartDate = boost.StartDate,
            ExpiryDate = boost.ExpiryDate,
            IsActive = boost.IsActive
        };
    }

    private string GetBoostTypeName(BoostType type)
    {
        return type switch
        {
            BoostType.TopOfRecommended => "ראש רשימת המומלצים",
            BoostType.HomepageBanner => "באנר בדף הבית",
            _ => "לא ידוע"
        };
    }
}
