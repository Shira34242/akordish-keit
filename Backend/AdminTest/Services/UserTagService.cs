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
    private const int TagScoreWeight = 100_000;
    private const int UploadScoreWeight = 100;
    private const int ReferralScoreWeight = 25;
    private const int ScoreInputCap = 1_000;

    private sealed record ContributionStats(int Count, DateTime? LatestAt);

    public UserTagService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task RecalculateTagAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return;

        // ספירת שירים שהמשתמש העלה ואושרו
        var songStats = await _context.Songs
            .Where(s => s.UploadedByUserId == userId && s.IsApproved && !s.IsDeleted)
            .GroupBy(_ => 1)
            .Select(group => new ContributionStats(group.Count(), group.Max(s => (DateTime?)s.CreatedAt)))
            .FirstOrDefaultAsync() ?? new ContributionStats(0, null);

        // ספירת כתבות שהמשתמש הגיש ואושרו (Published)
        var articleStats = await _context.Articles
            .Where(a => a.SubmittedByUserId == userId && a.Status == (int)ArticleStatus.Published && !a.IsDeleted)
            .GroupBy(_ => 1)
            .Select(group => new ContributionStats(group.Count(), group.Max(a => (DateTime?)a.CreatedAt)))
            .FirstOrDefaultAsync() ?? new ContributionStats(0, null);

        // ספירת אירועים שהמשתמש הגיש ואושרו (IsActive)
        var eventStats = await _context.Events
            .Where(e => e.SubmittedByUserId == userId && e.IsActive && !e.IsDeleted)
            .GroupBy(_ => 1)
            .Select(group => new ContributionStats(group.Count(), group.Max(e => (DateTime?)e.CreatedAt)))
            .FirstOrDefaultAsync() ?? new ContributionStats(0, null);

        var referralCount = await _context.UserReferrals
            .CountAsync(r => r.ReferrerUserId == userId);

        var totalCount = songStats.Count + articleStats.Count + eventStats.Count;

        // תאריך ההעלאה האחרונה
        DateTime? latestUpload = new[] { songStats.LatestAt, articleStats.LatestAt, eventStats.LatestAt }.Max();

        // בדיקת איפוס: אם לא הועלה תוכן מעל 4 חודשים
        bool isReset = latestUpload == null
            || DateTime.UtcNow - latestUpload.Value > ResetPeriod;

        int effectiveCount = isReset ? 0 : totalCount;

        user.UploadCount    = effectiveCount;
        user.LastUploadDate = latestUpload;
        user.ContentTag     = CalculateTag(effectiveCount);
        user.RankingScore   = CalculateRankingScore(user.ContentTag, effectiveCount, referralCount);

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

    private static int CalculateRankingScore(UserContentTag tag, int uploadCount, int referralCount)
    {
        var cappedUploads = Math.Clamp(uploadCount, 0, ScoreInputCap);
        var cappedReferrals = Math.Clamp(referralCount, 0, ScoreInputCap);
        return ((int)tag * TagScoreWeight) +
            (cappedUploads * UploadScoreWeight) +
            (cappedReferrals * ReferralScoreWeight);
    }

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
