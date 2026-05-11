using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class UserTagService : IUserTagService
{
    private readonly AkordishKeitDbContext _context;

    // סף ל-4 חודשים: אם ההעלאה האחרונה היתה לפני יותר מ-4 חודשים — איפוס
    private static readonly TimeSpan ResetPeriod = TimeSpan.FromDays(30 * 4);

    // ספי תגים
    private const int ContributorThreshold      = 5;
    private const int LeadingContributorThreshold = 20;

    public UserTagService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task RecalculateTagAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return;

        // ספירת שירים שהמשתמש העלה ואושרו
        var songCount = await _context.Songs
            .CountAsync(s => s.UploadedByUserId == userId && s.IsApproved && !s.IsDeleted);

        // ספירת כתבות שהמשתמש הגיש ואושרו (Published)
        var articleCount = await _context.Articles
            .CountAsync(a => a.SubmittedByUserId == userId && a.Status == (int)ArticleStatus.Published && !a.IsDeleted);

        // ספירת אירועים שהמשתמש הגיש ואושרו (IsActive)
        var eventCount = await _context.Events
            .CountAsync(e => e.SubmittedByUserId == userId && e.IsActive && !e.IsDeleted);

        var totalCount = songCount + articleCount + eventCount;

        // תאריך ההעלאה האחרונה
        var latestSong = await _context.Songs
            .Where(s => s.UploadedByUserId == userId && s.IsApproved && !s.IsDeleted)
            .MaxAsync(s => (DateTime?)s.CreatedAt);

        var latestArticle = await _context.Articles
            .Where(a => a.SubmittedByUserId == userId && a.Status == (int)ArticleStatus.Published && !a.IsDeleted)
            .MaxAsync(a => (DateTime?)a.CreatedAt);

        var latestEvent = await _context.Events
            .Where(e => e.SubmittedByUserId == userId && e.IsActive && !e.IsDeleted)
            .MaxAsync(e => (DateTime?)e.CreatedAt);

        DateTime? latestUpload = new[] { latestSong, latestArticle, latestEvent }.Max();

        // בדיקת איפוס: אם לא הועלה תוכן מעל 4 חודשים
        bool isReset = latestUpload == null
            || DateTime.UtcNow - latestUpload.Value > ResetPeriod;

        int effectiveCount = isReset ? 0 : totalCount;

        user.UploadCount    = effectiveCount;
        user.LastUploadDate = latestUpload;
        user.ContentTag     = CalculateTag(effectiveCount);

        await _context.SaveChangesAsync();
    }

    public async Task<UserTagDto?> GetUserTagAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        bool isReset = user.LastUploadDate == null
            || DateTime.UtcNow - user.LastUploadDate.Value > ResetPeriod;

        return new UserTagDto
        {
            UserId           = user.Id,
            Tag              = user.ContentTag.ToString(),
            TagHebrew        = GetTagHebrew(user.ContentTag),
            UploadCount      = isReset ? 0 : user.UploadCount,
            NextTagThreshold = GetNextThreshold(user.ContentTag),
            LastUploadDate   = user.LastUploadDate,
            ResetDate        = user.LastUploadDate?.Add(ResetPeriod),
            PlaylistLimit    = GetPlaylistLimit(user.ContentTag)
        };
    }

    public int GetPlaylistLimit(UserContentTag tag) => tag switch
    {
        UserContentTag.LeadingContributor => 20,
        UserContentTag.Contributor        => 3,
        _                                 => 1   // None / Beginner — מגבלת BASIC
    };

    // ════════════════════════════════════
    //   פנימי
    // ════════════════════════════════════

    private static UserContentTag CalculateTag(int count) => count switch
    {
        0                                         => UserContentTag.None,
        < ContributorThreshold                    => UserContentTag.Beginner,
        < LeadingContributorThreshold             => UserContentTag.Contributor,
        _                                         => UserContentTag.LeadingContributor
    };

    private static string GetTagHebrew(UserContentTag tag) => tag switch
    {
        UserContentTag.Beginner            => "מתחיל",
        UserContentTag.Contributor         => "תורם",
        UserContentTag.LeadingContributor  => "תורם מוביל",
        _                                  => string.Empty
    };

    private static int? GetNextThreshold(UserContentTag tag) => tag switch
    {
        UserContentTag.None      => ContributorThreshold,
        UserContentTag.Beginner  => ContributorThreshold,
        UserContentTag.Contributor => LeadingContributorThreshold,
        _                        => null   // כבר בדרגה הגבוהה
    };
}
