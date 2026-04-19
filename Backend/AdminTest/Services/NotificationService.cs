using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

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
            .Where(n => n.UserId == userId && !n.IsDeleted)
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

    public async Task<bool> SoftDeleteAsync(int notificationId, int userId)
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

    public Task<NotificationDto> SendAdminMessageAsync(int userId, string title, string message, string? actionUrl, int createdByUserId)
    {
        return CreateAsync(new CreateNotificationDto
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = NotificationType.AdminMessage,
            Category = NotificationCategory.System,
            RelatedEntityType = "AdminMessage",
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
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            ReadAt = notification.ReadAt,
            CreatedByUserId = notification.CreatedByUserId
        };
    }
}
