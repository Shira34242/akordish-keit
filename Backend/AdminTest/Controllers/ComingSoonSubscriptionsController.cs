using System.Text.Json;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class ComingSoonSubscriptionsController : ControllerBase
{
    private const string SubscribersKey = "coming_soon_subscribers";
    private const string SubscribersDescription = "רשימת מיילים לקבלת עדכון כשהאתר יעלה";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly ISystemSettingsService _settingsService;

    public ComingSoonSubscriptionsController(ISystemSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpPost]
    public async Task<ActionResult<ComingSoonSubscriptionDto>> Subscribe([FromBody] CreateComingSoonSubscriptionDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var email = request.Email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;
        var subscribers = await LoadSubscribersAsync();
        var subscriber = subscribers.FirstOrDefault(item => item.Email == email);

        if (subscriber == null)
        {
            subscriber = new ComingSoonSubscriptionDto
            {
                Id = subscribers.Count == 0 ? 1 : subscribers.Max(item => item.Id) + 1,
                Email = email,
                CreatedAt = now,
                IsActive = true
            };
            subscribers.Add(subscriber);
        }
        else
        {
            subscriber.IsActive = true;
        }

        await _settingsService.UpsertAsync(
            SubscribersKey,
            JsonSerializer.Serialize(subscribers, JsonOptions),
            SubscribersDescription);

        return Ok(subscriber);
    }

    private async Task<List<ComingSoonSubscriptionDto>> LoadSubscribersAsync()
    {
        var rawValue = await _settingsService.GetValueAsync(SubscribersKey);
        if (string.IsNullOrWhiteSpace(rawValue))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<ComingSoonSubscriptionDto>>(rawValue, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
