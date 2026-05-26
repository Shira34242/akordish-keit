using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AkordishKeit.Services;

public class NotificationService : INotificationService
{
    private readonly AkordishKeitDbContext _context;

    public NotificationService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<NotificationDto> CreateAsync(CreateNotificationDto dto)
    {
        var userExists = await _context.Users.AnyAsync(u => u.Id == dto.UserId && !u.IsDeleted);
        if (!userExists)
        {
            throw new InvalidOperationException("משתמש לא נמצא");
        }

        var notification = new Notification
        {
            UserId = dto.UserId,
            Title = dto.Title.Trim(),
            Message = dto.Message.Trim(),
            Type = dto.Type,
            Category = dto.Category,
            RelatedEntityType = dto.RelatedEntityType,
            RelatedEntityId = dto.RelatedEntityId,
            ActionUrl = dto.ActionUrl,
            MediaUrl = NormalizeOptional(dto.MediaUrl),
            MediaType = NormalizeOptional(dto.MediaType),
            MediaThumbnailUrl = NormalizeOptional(dto.MediaThumbnailUrl),
            MediaAltText = NormalizeOptional(dto.MediaAltText),
            MediaDisplaySize = NormalizeMediaDisplaySize(dto.MediaDisplaySize),
            AttachmentsJson = SerializeAttachments(dto.Attachments),
            CampaignName = NormalizeOptional(dto.CampaignName),
            AudienceLabel = NormalizeOptional(dto.AudienceLabel),
            CreatedByUserId = dto.CreatedByUserId,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
            IsDeleted = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return MapToDto(notification);
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, int pageNumber = 1, int pageSize = 30)
    {
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsDeleted)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return notifications.Select(MapToDto).ToList();
    }

    public async Task<List<NotificationDto>> GetUserNotificationsForAdminAsync(int userId, int pageNumber = 1, int pageSize = 50)
    {
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return notifications.Select(MapToDto).ToList();
    }

    public Task<int> GetUnreadCountAsync(int userId)
    {
        return _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.IsRead && !n.IsDeleted);
    }

    public async Task<bool> MarkAsReadAsync(int notificationId, int userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId && !n.IsDeleted);

        if (notification == null)
        {
            return false;
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return true;
    }

    public async Task MarkAllAsReadAsync(int userId)
    {
        var now = DateTime.UtcNow;
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead && !n.IsDeleted)
            .ToListAsync();

        foreach (var notification in notifications)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }

        await _context.SaveChangesAsync();
    }

    public async Task<bool> DeleteAsync(int notificationId, int userId)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId && !n.IsDeleted);

        if (notification == null)
        {
            return false;
        }

        notification.IsDeleted = true;
        notification.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task DeleteAllAsync(int userId)
    {
        var now = DateTime.UtcNow;
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsDeleted)
            .ToListAsync();

        foreach (var notification in notifications)
        {
            notification.IsDeleted = true;
            notification.DeletedAt = now;
        }

        await _context.SaveChangesAsync();
    }

    public Task<NotificationDto> SendAdminMessageAsync(SendUserNotificationDto dto, int createdByUserId)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = dto.UserId,
            Title = dto.Title,
            Message = dto.Message,
            Type = dto.IsMarketingContent ? NotificationType.Promotion : NotificationType.AdminMessage,
            Category = dto.IsMarketingContent ? NotificationCategory.Promotion : NotificationCategory.System,
            RelatedEntityType = "AdminMessage",
            ActionUrl = dto.ActionUrl,
            MediaUrl = dto.MediaUrl,
            MediaType = dto.MediaType,
            MediaThumbnailUrl = dto.MediaThumbnailUrl,
            MediaAltText = dto.MediaAltText,
            MediaDisplaySize = dto.MediaDisplaySize,
            Attachments = dto.Attachments,
            CreatedByUserId = createdByUserId
        });
    }

    public async Task<BroadcastNotificationResultDto> SendBroadcastAsync(SendBroadcastNotificationDto dto, int createdByUserId)
    {
        if (dto.GroupId.HasValue && dto.GroupId.Value > 0)
        {
            var group = await _context.NotificationGroups
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == dto.GroupId.Value && !item.IsDeleted);

            if (group == null)
            {
                throw new InvalidOperationException("קבוצת ההתראות לא נמצאה");
            }

            ApplyGroupToBroadcastDto(dto, group);
            dto.UserIds = await _context.NotificationGroupMembers
                .AsNoTracking()
                .Where(member => member.NotificationGroupId == group.Id)
                .Select(member => member.UserId)
                .ToListAsync();
        }

        var query = _context.Users
            .AsNoTracking()
            .Where(user => !user.IsDeleted);

        if (dto.UserIds is { Count: > 0 })
        {
            var ids = dto.UserIds.Distinct().ToList();
            query = query.Where(user => ids.Contains(user.Id));
        }
        else
        {
            if (!dto.SendToAll)
            {
                query = ApplyBroadcastFilters(query, dto);
            }
        }

        if (!dto.SendToAll && (dto.UserIds == null || dto.UserIds.Count == 0) && !HasBroadcastFilter(dto))
        {
            throw new InvalidOperationException("יש לבחור קהל יעד או לסמן שליחה לכולם");
        }

        var users = await query
            .Select(user => new { user.Id })
            .ToListAsync();

        if (users.Count == 0)
        {
            throw new InvalidOperationException("לא נמצאו משתמשים שמתאימים לסינון");
        }

        var now = DateTime.UtcNow;
        var audienceLabel = BuildAudienceLabel(dto, users.Count);
        var notifications = users.Select(user => new Notification
        {
            UserId = user.Id,
            Title = dto.Title.Trim(),
            Message = dto.Message.Trim(),
            Type = dto.IsMarketingContent ? NotificationType.Promotion : NotificationType.AdminMessage,
            Category = dto.IsMarketingContent ? NotificationCategory.Promotion : NotificationCategory.System,
            RelatedEntityType = "Broadcast",
            ActionUrl = NormalizeOptional(dto.ActionUrl),
            MediaUrl = NormalizeOptional(dto.MediaUrl),
            MediaType = NormalizeOptional(dto.MediaType),
            MediaThumbnailUrl = NormalizeOptional(dto.MediaThumbnailUrl),
            MediaAltText = NormalizeOptional(dto.MediaAltText),
            MediaDisplaySize = NormalizeMediaDisplaySize(dto.MediaDisplaySize),
            AttachmentsJson = SerializeAttachments(dto.Attachments),
            CampaignName = NormalizeOptional(dto.CampaignName),
            AudienceLabel = audienceLabel,
            CreatedByUserId = createdByUserId,
            CreatedAt = now,
            IsRead = false,
            IsDeleted = false
        }).ToList();

        _context.Notifications.AddRange(notifications);
        await _context.SaveChangesAsync();

        return new BroadcastNotificationResultDto
        {
            SentCount = notifications.Count,
            AudienceLabel = audienceLabel
        };
    }

    public async Task<List<NotificationGroupDto>> GetGroupsAsync()
    {
        var groups = await _context.NotificationGroups
            .AsNoTracking()
            .Where(group => !group.IsDeleted)
            .OrderByDescending(group => group.CreatedAt)
            .ToListAsync();

        var result = new List<NotificationGroupDto>
        {
            new()
            {
                Id = 0,
                Name = "כל חברי האתר",
                Description = "קבוצת ברירת מחדל הכוללת את כל המשתמשים באתר",
                SendToAll = true,
                EstimatedUserCount = await _context.Users.CountAsync(user => !user.IsDeleted),
                CreatedAt = DateTime.UtcNow
            }
        };

        foreach (var group in groups)
        {
            result.Add(await MapGroupToDtoAsync(group));
        }

        return result;
    }

    public async Task<NotificationGroupDto> CreateGroupAsync(SaveNotificationGroupDto dto, int createdByUserId)
    {
        var group = new NotificationGroup
        {
            Name = NormalizeRequired(dto.Name, "שם קבוצה"),
            Description = NormalizeOptional(dto.Description),
            ImageUrl = NormalizeOptional(dto.ImageUrl),
            SendToAll = dto.SendToAll,
            Role = dto.Role,
            IsActive = dto.IsActive,
            ContentTag = dto.ContentTag,
            PreferredInstrumentId = dto.PreferredInstrumentId,
            JoinedFrom = dto.JoinedFrom,
            JoinedTo = dto.JoinedTo,
            AddressContains = NormalizeOptional(dto.AddressContains),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = createdByUserId,
            IsDeleted = false
        };

        _context.NotificationGroups.Add(group);
        await _context.SaveChangesAsync();
        await ReplaceGroupMembersAsync(group.Id, dto.MemberUserIds);

        return await MapGroupToDtoAsync(group);
    }

    public async Task<NotificationGroupDto?> UpdateGroupAsync(int groupId, SaveNotificationGroupDto dto)
    {
        var group = await _context.NotificationGroups
            .FirstOrDefaultAsync(item => item.Id == groupId && !item.IsDeleted);

        if (group == null)
        {
            return null;
        }

        group.Name = NormalizeRequired(dto.Name, "שם קבוצה");
        group.Description = NormalizeOptional(dto.Description);
        group.ImageUrl = NormalizeOptional(dto.ImageUrl);
        group.SendToAll = dto.SendToAll;
        group.Role = dto.Role;
        group.IsActive = dto.IsActive;
        group.ContentTag = dto.ContentTag;
        group.PreferredInstrumentId = dto.PreferredInstrumentId;
        group.JoinedFrom = dto.JoinedFrom;
        group.JoinedTo = dto.JoinedTo;
        group.AddressContains = NormalizeOptional(dto.AddressContains);
        group.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await ReplaceGroupMembersAsync(group.Id, dto.MemberUserIds);
        return await MapGroupToDtoAsync(group);
    }

    public async Task<bool> DeleteGroupAsync(int groupId)
    {
        var group = await _context.NotificationGroups
            .FirstOrDefaultAsync(item => item.Id == groupId && !item.IsDeleted);

        if (group == null)
        {
            return false;
        }

        group.IsDeleted = true;
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public Task<NotificationDto> SendStatusUpdateAsync(
        int userId,
        string title,
        string message,
        NotificationType type,
        NotificationCategory category,
        string? relatedEntityType,
        int? relatedEntityId,
        string? actionUrl,
        int createdByUserId)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            Category = category,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            ActionUrl = actionUrl,
            CreatedByUserId = createdByUserId
        });
    }

    public Task NotifySongSubmittedAsync(int userId, int songId, string songTitle)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "השיר נשלח לאישור",
            Message = $"השיר \"{songTitle}\" התקבל במערכת וממתין לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.Song,
            RelatedEntityType = "Song",
            RelatedEntityId = songId
        });
    }

    public Task NotifySongApprovedAsync(int userId, int songId, string songTitle)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "השיר אושר",
            Message = $"השיר \"{songTitle}\" אושר וניתן לצפייה באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.Song,
            RelatedEntityType = "Song",
            RelatedEntityId = songId,
            ActionUrl = $"/song/{songId}"
        });
    }

    public Task NotifyArticleSubmittedAsync(int userId, int articleId, string articleTitle)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "הכתבה נשלחה לאישור",
            Message = $"הכתבה \"{articleTitle}\" התקבלה במערכת וממתינה לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.Article,
            RelatedEntityType = "Article",
            RelatedEntityId = articleId
        });
    }

    public Task NotifyArticleApprovedAsync(int userId, int articleId, string articleTitle, string? slug, int contentType)
    {
        var routePrefix = contentType == (int)ArticleContentType.Blog ? "/blog" : "/news";
        var actionUrl = string.IsNullOrWhiteSpace(slug) ? null : $"{routePrefix}/{slug}";

        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "הכתבה פורסמה",
            Message = $"הכתבה \"{articleTitle}\" פורסמה באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.Article,
            RelatedEntityType = "Article",
            RelatedEntityId = articleId,
            ActionUrl = actionUrl
        });
    }

    public Task NotifyEventSubmittedAsync(int userId, int eventId, string eventName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "האירוע נשלח לאישור",
            Message = $"האירוע \"{eventName}\" התקבל במערכת וממתין לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.Event,
            RelatedEntityType = "Event",
            RelatedEntityId = eventId
        });
    }

    public Task NotifyEventApprovedAsync(int userId, int eventId, string eventName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "האירוע אושר",
            Message = $"האירוע \"{eventName}\" אושר ויופיע באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.Event,
            RelatedEntityType = "Event",
            RelatedEntityId = eventId
        });
    }

    public Task NotifyTeacherSubmittedAsync(int userId, int teacherId, string displayName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף המורה נשלח לאישור",
            Message = $"דף המורה \"{displayName}\" התקבל במערכת וממתין לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.Teacher,
            RelatedEntityType = "Teacher",
            RelatedEntityId = teacherId
        });
    }

    public Task NotifyTeacherApprovedAsync(int userId, int teacherId, string displayName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף המורה אושר",
            Message = $"דף המורה \"{displayName}\" אושר וניתן לצפייה באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.Teacher,
            RelatedEntityType = "Teacher",
            RelatedEntityId = teacherId,
            ActionUrl = $"/teacher/{teacherId}"
        });
    }

    public Task NotifyServiceProviderSubmittedAsync(int userId, int providerId, string displayName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף בעל המקצוע נשלח לאישור",
            Message = $"דף בעל המקצוע \"{displayName}\" התקבל במערכת וממתין לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.ServiceProvider,
            RelatedEntityType = "ServiceProvider",
            RelatedEntityId = providerId
        });
    }

    public Task NotifyServiceProviderApprovedAsync(int userId, int providerId, string displayName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף בעל המקצוע אושר",
            Message = $"דף בעל המקצוע \"{displayName}\" אושר וניתן לצפייה באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.ServiceProvider,
            RelatedEntityType = "ServiceProvider",
            RelatedEntityId = providerId,
            ActionUrl = $"/professional/{providerId}"
        });
    }

    public Task NotifyArtistSubmittedAsync(int userId, int artistId, string artistName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף האמן נשלח לאישור",
            Message = $"דף האמן \"{artistName}\" התקבל במערכת וממתין לאישור מנהל.",
            Type = NotificationType.Submission,
            Category = NotificationCategory.Artist,
            RelatedEntityType = "Artist",
            RelatedEntityId = artistId
        });
    }

    public Task NotifyArtistApprovedAsync(int userId, int artistId, string artistName)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = "דף האמן אושר",
            Message = $"דף האמן \"{artistName}\" אושר וניתן לצפייה באתר.",
            Type = NotificationType.Approval,
            Category = NotificationCategory.Artist,
            RelatedEntityType = "Artist",
            RelatedEntityId = artistId,
            ActionUrl = $"/artist/{artistId}"
        });
    }

    private static NotificationDto MapToDto(Notification notification)
    {
        return new NotificationDto
        {
            Id = notification.Id,
            Title = notification.Title,
            Message = notification.Message,
            Type = notification.Type,
            Category = notification.Category,
            RelatedEntityType = notification.RelatedEntityType,
            RelatedEntityId = notification.RelatedEntityId,
            ActionUrl = notification.ActionUrl,
            MediaUrl = notification.MediaUrl,
            MediaType = notification.MediaType,
            MediaThumbnailUrl = notification.MediaThumbnailUrl,
            MediaAltText = notification.MediaAltText,
            MediaDisplaySize = notification.MediaDisplaySize,
            Attachments = DeserializeAttachments(notification.AttachmentsJson),
            CampaignName = notification.CampaignName,
            AudienceLabel = notification.AudienceLabel,
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            ReadAt = notification.ReadAt,
            CreatedByUserId = notification.CreatedByUserId
        };
    }

    private static IQueryable<User> ApplyBroadcastFilters(IQueryable<User> query, SendBroadcastNotificationDto dto)
    {
        if (dto.Role.HasValue)
        {
            query = query.Where(user => (int)user.Role == dto.Role.Value);
        }

        if (dto.IsActive.HasValue)
        {
            query = query.Where(user => user.IsActive == dto.IsActive.Value);
        }

        if (dto.ContentTag.HasValue)
        {
            query = query.Where(user => (int)user.ContentTag == dto.ContentTag.Value);
        }

        if (dto.PreferredInstrumentId.HasValue)
        {
            query = query.Where(user => user.PreferredInstrumentId == dto.PreferredInstrumentId.Value);
        }

        if (dto.JoinedFrom.HasValue)
        {
            query = query.Where(user => user.CreatedAt >= dto.JoinedFrom.Value);
        }

        if (dto.JoinedTo.HasValue)
        {
            query = query.Where(user => user.CreatedAt <= dto.JoinedTo.Value);
        }

        if (!string.IsNullOrWhiteSpace(dto.AddressContains))
        {
            var address = dto.AddressContains.Trim();
            query = query.Where(user => user.Address != null && user.Address.Contains(address));
        }

        return query;
    }

    private static bool HasBroadcastFilter(SendBroadcastNotificationDto dto)
    {
        return dto.Role.HasValue
            || dto.IsActive.HasValue
            || dto.ContentTag.HasValue
            || dto.PreferredInstrumentId.HasValue
            || dto.JoinedFrom.HasValue
            || dto.JoinedTo.HasValue
            || dto.GroupId.HasValue
            || !string.IsNullOrWhiteSpace(dto.AddressContains);
    }

    private static string BuildAudienceLabel(SendBroadcastNotificationDto dto, int count)
    {
        if (dto.UserIds is { Count: > 0 })
        {
            return $"משתמשים שנבחרו ידנית ({count})";
        }

        if (dto.SendToAll)
        {
            return $"כל המשתמשים ({count})";
        }

        var parts = new List<string>();
        if (dto.Role.HasValue) parts.Add($"תפקיד {dto.Role.Value}");
        if (dto.IsActive.HasValue) parts.Add(dto.IsActive.Value ? "פעילים" : "לא פעילים");
        if (dto.ContentTag.HasValue) parts.Add($"רמת תרומה {dto.ContentTag.Value}");
        if (dto.PreferredInstrumentId.HasValue) parts.Add($"כלי {dto.PreferredInstrumentId.Value}");
        if (dto.JoinedFrom.HasValue) parts.Add($"הצטרפו מ-{dto.JoinedFrom.Value:dd/MM/yyyy}");
        if (dto.JoinedTo.HasValue) parts.Add($"הצטרפו עד {dto.JoinedTo.Value:dd/MM/yyyy}");
        if (!string.IsNullOrWhiteSpace(dto.AddressContains)) parts.Add($"כתובת כוללת {dto.AddressContains.Trim()}");

        return parts.Count > 0 ? $"{string.Join(", ", parts)} ({count})" : $"קהל מסונן ({count})";
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string NormalizeRequired(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"{fieldName} הוא שדה חובה");
        }

        return value.Trim();
    }

    private static string NormalizeMediaDisplaySize(string? value)
    {
        return NormalizeOptional(value)?.ToLowerInvariant() switch
        {
            "small" => "small",
            "large" => "large",
            _ => "medium"
        };
    }

    private async Task<NotificationGroupDto> MapGroupToDtoAsync(NotificationGroup group)
    {
        var filter = new SendBroadcastNotificationDto
        {
            SendToAll = group.SendToAll,
            Role = group.Role,
            IsActive = group.IsActive,
            ContentTag = group.ContentTag,
            PreferredInstrumentId = group.PreferredInstrumentId,
            JoinedFrom = group.JoinedFrom,
            JoinedTo = group.JoinedTo,
            AddressContains = group.AddressContains
        };

        var memberIds = await _context.NotificationGroupMembers
            .AsNoTracking()
            .Where(member => member.NotificationGroupId == group.Id)
            .Select(member => member.UserId)
            .ToListAsync();

        var query = _context.Users.AsNoTracking().Where(user => !user.IsDeleted);
        if (memberIds.Count > 0)
        {
            query = query.Where(user => memberIds.Contains(user.Id));
        }
        else if (!filter.SendToAll)
        {
            query = ApplyBroadcastFilters(query, filter);
        }

        return new NotificationGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            ImageUrl = group.ImageUrl,
            SendToAll = group.SendToAll,
            Role = group.Role,
            IsActive = group.IsActive,
            ContentTag = group.ContentTag,
            PreferredInstrumentId = group.PreferredInstrumentId,
            JoinedFrom = group.JoinedFrom,
            JoinedTo = group.JoinedTo,
            AddressContains = group.AddressContains,
            MemberUserIds = memberIds,
            EstimatedUserCount = await query.CountAsync(),
            CreatedAt = group.CreatedAt
        };
    }

    private static void ApplyGroupToBroadcastDto(SendBroadcastNotificationDto dto, NotificationGroup group)
    {
        dto.SendToAll = group.SendToAll;
        dto.Role = group.Role;
        dto.IsActive = group.IsActive;
        dto.ContentTag = group.ContentTag;
        dto.PreferredInstrumentId = group.PreferredInstrumentId;
        dto.JoinedFrom = group.JoinedFrom;
        dto.JoinedTo = group.JoinedTo;
        dto.AddressContains = group.AddressContains;
    }

    private async Task ReplaceGroupMembersAsync(int groupId, List<int>? memberUserIds)
    {
        var existing = await _context.NotificationGroupMembers
            .Where(member => member.NotificationGroupId == groupId)
            .ToListAsync();

        _context.NotificationGroupMembers.RemoveRange(existing);

        var ids = memberUserIds?
            .Where(id => id > 0)
            .Distinct()
            .ToList() ?? new List<int>();

        if (ids.Count > 0)
        {
            var validIds = await _context.Users
                .AsNoTracking()
                .Where(user => ids.Contains(user.Id) && !user.IsDeleted)
                .Select(user => user.Id)
                .ToListAsync();

            var now = DateTime.UtcNow;
            _context.NotificationGroupMembers.AddRange(validIds.Select(userId => new NotificationGroupMember
            {
                NotificationGroupId = groupId,
                UserId = userId,
                CreatedAt = now
            }));
        }

        await _context.SaveChangesAsync();
    }

    private static string? SerializeAttachments(List<NotificationAttachmentDto>? attachments)
    {
        var normalized = NormalizeAttachments(attachments);
        return normalized.Count == 0 ? null : JsonSerializer.Serialize(normalized);
    }

    private static List<NotificationAttachmentDto> DeserializeAttachments(string? attachmentsJson)
    {
        if (string.IsNullOrWhiteSpace(attachmentsJson))
        {
            return new List<NotificationAttachmentDto>();
        }

        try
        {
            return NormalizeAttachments(JsonSerializer.Deserialize<List<NotificationAttachmentDto>>(attachmentsJson));
        }
        catch (JsonException)
        {
            return new List<NotificationAttachmentDto>();
        }
    }

    private static List<NotificationAttachmentDto> NormalizeAttachments(List<NotificationAttachmentDto>? attachments)
    {
        return attachments?
            .Where(item => !string.IsNullOrWhiteSpace(item.Type) && !string.IsNullOrWhiteSpace(item.Url))
            .Take(8)
            .Select(item => new NotificationAttachmentDto
            {
                Type = item.Type.Trim().ToLowerInvariant(),
                Url = item.Url.Trim(),
                Label = NormalizeOptional(item.Label),
                ClickUrl = NormalizeOptional(item.ClickUrl)
            })
            .ToList() ?? new List<NotificationAttachmentDto>();
    }
}
