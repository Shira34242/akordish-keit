using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

public class ReportService : IReportService
{
    private const string ChordRequestAdminOnlyMarker = "[ChordRequestAdminOnly]";
    private readonly AkordishKeitDbContext _context;

    public ReportService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<int> CreateReportAsync(CreateReportDto dto, int? userId, string? ipAddress)
    {
        var report = new ContentReport
        {
            UserId = userId,
            ContentType = dto.ContentType,
            ContentId = dto.ContentId,
            ReportType = dto.ReportType,
            Description = dto.Description,
            ReportedAt = DateTime.UtcNow,
            Status = "Pending"
        };

        _context.ContentReports.Add(report);
        await _context.SaveChangesAsync();

        // Send email notification to admins
        await SendReportNotificationEmailAsync(report);

        return report.Id;
    }

    public async Task<bool> CanAccessChordRequestsAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.ServiceProviderProfiles)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted && u.IsActive);

        if (user == null)
            return false;

        if (user.Role == UserRole.Admin || user.Role == UserRole.Manager)
            return true;

        if (user.ContentTag >= UserContentTag.Contributor)
            return true;

        return user.ServiceProviderProfiles.Any(p => p.UserId == userId && !p.IsDeleted);
    }

    public async Task<PagedResult<ChordRequestDto>> GetChordRequestsAsync(int pageNumber, int pageSize, int userId)
    {
        var canSeeAdminOnly = await IsAdminOrManagerAsync(userId);

        var reports = await _context.ContentReports
            .Where(r =>
                r.ContentType == "Song" &&
                r.ContentId == 0 &&
                r.Status == "Pending" &&
                (r.ReportType == "ChordRequest" ||
                 (r.ReportType == "Other" && r.Description.Contains("בקשת אקורדים"))))
            .OrderByDescending(r => r.ReportedAt)
            .ToListAsync();

        var grouped = reports
            .Select(report => new { Report = report, Request = ParseChordRequest(report.Description) })
            .Where(item => !string.IsNullOrWhiteSpace(item.Request.SongName))
            .GroupBy(item => $"{NormalizeRequestText(item.Request.SongName)}|{NormalizeRequestText(item.Request.ArtistName)}")
            .Select(group =>
            {
                var ordered = group.OrderByDescending(item => item.Report.ReportedAt).ToList();
                var latest = ordered[0];
                var isAdminOnly = group.Any(item => IsChordRequestAdminOnly(item.Report));

                return new ChordRequestDto
                {
                    Id = latest.Report.Id,
                    SongName = latest.Request.SongName,
                    ArtistName = latest.Request.ArtistName,
                    RequestCount = group.Count(),
                    FirstReportedAt = group.Min(item => item.Report.ReportedAt),
                    LastReportedAt = group.Max(item => item.Report.ReportedAt),
                    Status = "Pending",
                    IsAdminOnly = isAdminOnly,
                    ReportIds = ordered.Select(item => item.Report.Id).ToList()
                };
            })
            .Where(item => canSeeAdminOnly || !item.IsAdminOnly)
            .OrderByDescending(item => item.RequestCount)
            .ThenByDescending(item => item.LastReportedAt)
            .ToList();

        var openRequests = new List<ChordRequestDto>();
        foreach (var request in grouped)
        {
            var match = await FindChordRequestMatchesAsync(request.SongName, request.ArtistName);
            if (!match.HasMatches)
            {
                openRequests.Add(request);
            }
        }

        var safePageNumber = Math.Max(1, pageNumber);
        var safePageSize = Math.Clamp(pageSize, 1, 100);

        return new PagedResult<ChordRequestDto>
        {
            Items = openRequests
                .Skip((safePageNumber - 1) * safePageSize)
                .Take(safePageSize)
                .ToList(),
            TotalCount = openRequests.Count,
            PageNumber = safePageNumber,
            PageSize = safePageSize
        };
    }

    public async Task<ChordRequestMatchDto> FindChordRequestMatchesAsync(string songName, string? artistName)
    {
        if (string.IsNullOrWhiteSpace(songName) || songName.Trim().Length < 2)
        {
            return new ChordRequestMatchDto();
        }

        var normalizedSong = NormalizeRequestText(songName);
        var normalizedArtist = NormalizeRequestText(artistName ?? string.Empty);
        var titleTokens = ExtractRequestTokens(normalizedSong);
        var longestToken = titleTokens
            .OrderByDescending(token => token.Length)
            .FirstOrDefault();

        var query = _context.Songs
            .Where(s => !s.IsDeleted && s.IsApproved)
            .Include(s => s.SongArtists)
                .ThenInclude(sa => sa.Artist)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(longestToken))
        {
            query = query.Where(s =>
                s.Title.Contains(longestToken) ||
                s.SongArtists.Any(sa =>
                    (sa.Artist != null && sa.Artist.Name.Contains(longestToken)) ||
                    (sa.TempArtistName != null && sa.TempArtistName.Contains(longestToken))));
        }

        var candidates = await query
            .OrderByDescending(s => s.ViewCount)
            .Take(80)
            .Select(s => new SongBasicDto
            {
                Id = s.Id,
                Title = s.Title,
                ArtistNames = string.Join(", ", s.SongArtists
                    .OrderBy(sa => sa.Order)
                    .Select(sa => sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown")),
                ImageUrl = s.ImageUrl,
                ViewCount = s.ViewCount
            })
            .ToListAsync();

        var matches = candidates
            .Select(song =>
            {
                var titleScore = ScoreRequestText(normalizedSong, NormalizeRequestText(song.Title));
                var artistScore = string.IsNullOrWhiteSpace(normalizedArtist)
                    ? 0
                    : ScoreRequestText(normalizedArtist, NormalizeRequestText(song.ArtistNames));
                var totalScore = titleScore + (artistScore >= 60 ? 20 : 0);

                return new { Song = song, Score = totalScore };
            })
            .Where(item => item.Score >= 76)
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.Song.Title)
            .Take(3)
            .Select(item => item.Song)
            .ToList();

        return new ChordRequestMatchDto
        {
            HasMatches = matches.Any(),
            SimilarSongs = matches
        };
    }

    public async Task<bool> UpdateChordRequestGroupAsync(UpdateChordRequestGroupDto dto, int resolvedByUserId)
    {
        var ids = dto.ReportIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            return false;
        }

        var reports = await _context.ContentReports
            .Where(r => ids.Contains(r.Id) &&
                        (r.ReportType == "ChordRequest" ||
                         (r.ReportType == "Other" && r.Description.Contains("בקשת אקורדים"))))
            .ToListAsync();

        if (reports.Count == 0)
        {
            return false;
        }

        foreach (var report in reports)
        {
            switch (dto.Action)
            {
                case "Close":
                    report.Status = "Dismissed";
                    report.AdminNotes = "בקשת אקורדים נסגרה על ידי מנהל";
                    report.ResolvedAt = DateTime.UtcNow;
                    report.ResolvedByUserId = resolvedByUserId;
                    break;
                case "AdminOnly":
                    report.AdminNotes = MergeAdminOnlyMarker(report.AdminNotes);
                    break;
                case "Public":
                    report.AdminNotes = RemoveAdminOnlyMarker(report.AdminNotes);
                    break;
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<PagedResult<ReportDto>> GetReportsAsync(
        int pageNumber,
        int pageSize,
        string? status,
        string? contentType,
        string? reportType)
    {
        var query = _context.ContentReports
            .Include(r => r.User)
            .Include(r => r.ResolvedByUser)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(r => r.Status == status);
        }

        if (!string.IsNullOrEmpty(contentType))
        {
            // Special handling for "NewContent" - includes all new content types
            if (contentType == "NewContent")
            {
                query = query.Where(r =>
                    r.ContentType == "Genre" ||
                    r.ContentType == "Tag" ||
                    r.ContentType == "Person" ||
                    r.ReportType == "NewArtist" // Special case: NewArtist uses ContentType="Song"
                );
            }
            else
            {
                query = query.Where(r => r.ContentType == contentType);
            }
        }

        if (!string.IsNullOrEmpty(reportType))
        {
            query = query.Where(r => r.ReportType == reportType);
        }

        // Order by newest first
        query = query.OrderByDescending(r => r.ReportedAt);

        // Get paginated results
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = new List<ReportDto>();
        foreach (var report in pagedEntities.Items)
        {
            var dto = await MapToDtoAsync(report);
            dtos.Add(dto);
        }

        return new PagedResult<ReportDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }

    public async Task<ReportDto?> GetReportByIdAsync(int id)
    {
        var report = await _context.ContentReports
            .Include(r => r.User)
            .Include(r => r.ResolvedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (report == null)
            return null;

        return await MapToDtoAsync(report);
    }

    public async Task<bool> UpdateReportStatusAsync(int id, UpdateReportStatusDto dto, int resolvedByUserId)
    {
        var report = await _context.ContentReports.FindAsync(id);

        if (report == null)
            return false;

        report.Status = dto.Status;
        report.AdminNotes = dto.AdminNotes;
        report.ResolvedAt = DateTime.UtcNow;
        report.ResolvedByUserId = resolvedByUserId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteReportAsync(int id)
    {
        var report = await _context.ContentReports.FindAsync(id);

        if (report == null)
            return false;

        // Hard delete - no soft delete as requested
        _context.ContentReports.Remove(report);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Success, string Message, int? ArtistId)> ApproveNewArtistAsync(int reportId, int adminUserId)
    {
        var report = await _context.ContentReports.FindAsync(reportId);

        if (report == null)
            return (false, "דיווח לא נמצא", null);

        if (report.ReportType != "NewArtist")
            return (false, "דיווח אינו מסוג אמן חדש", null);

        if (report.Status != "Pending")
            return (false, "הדיווח כבר טופל", null);

        // חילוץ שם האמן מהתיאור
        var artistName = ExtractArtistNameFromDescription(report.Description);
        if (artistName == null)
            return (false, "לא ניתן לחלץ שם אמן מהתיאור", null);

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // יצירת אמן חדש
            var artist = new Artist
            {
                Name = artistName,
                Status = ArtistStatus.Active,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };
            _context.Artists.Add(artist);
            await _context.SaveChangesAsync();

            // קישור כל ה-SongArtists הזמניים עם שם זה לאמן החדש
            var allTempSongArtists = await _context.SongArtists
                .Where(sa => sa.IsTemporary && sa.TempArtistName == artistName)
                .ToListAsync();

            foreach (var sa in allTempSongArtists)
            {
                sa.ArtistId = artist.Id;
                sa.IsTemporary = false;
                sa.TempArtistName = null;
            }

            // סגירת כל הדיווחים הפתוחים לאמן זה
            var artistMarker = $"'{artistName}'";
            var allPendingReports = await _context.ContentReports
                .Where(r =>
                    r.ReportType == "NewArtist" &&
                    r.Status == "Pending" &&
                    r.Description.Contains(artistMarker))
                .ToListAsync();

            foreach (var r in allPendingReports)
            {
                r.Status = "Resolved";
                r.ResolvedAt = DateTime.UtcNow;
                r.ResolvedByUserId = adminUserId;
                r.AdminNotes = $"אמן '{artistName}' נוצר ואושר על ידי מנהל ({allTempSongArtists.Count} שירים קושרו)";
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return (true, $"האמן '{artistName}' נוצר ואושר בהצלחה ({allTempSongArtists.Count} שירים קושרו)", artist.Id);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return (false, $"שגיאה ביצירת האמן: {ex.Message}", null);
        }
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private async Task<ReportDto> MapToDtoAsync(ContentReport report)
    {
        var (contentTitle, contentUrl) = await GetContentInfoAsync(report.ContentType, report.ContentId);

        int? songCount = null;
        if (report.ReportType == "NewArtist")
        {
            var artistName = ExtractArtistNameFromDescription(report.Description);
            if (artistName != null)
            {
                songCount = await _context.SongArtists
                    .CountAsync(sa => sa.IsTemporary && sa.TempArtistName == artistName);
            }
        }

        return new ReportDto
        {
            Id = report.Id,
            ContentType = report.ContentType,
            ContentId = report.ContentId,
            ContentTitle = contentTitle,
            ContentUrl = contentUrl,
            ReportType = report.ReportType,
            Description = report.Description,
            ReportedAt = report.ReportedAt,
            Status = report.Status,
            ReporterUsername = report.User?.Username,
            ResolvedAt = report.ResolvedAt,
            ResolvedByUsername = report.ResolvedByUser?.Username,
            AdminNotes = report.AdminNotes,
            SongCount = songCount
        };
    }

    private static string? ExtractArtistNameFromDescription(string description)
    {
        var firstQuote = description.IndexOf('\'');
        var secondQuote = firstQuote >= 0 ? description.IndexOf('\'', firstQuote + 1) : -1;
        if (firstQuote < 0 || secondQuote < 0) return null;
        return description.Substring(firstQuote + 1, secondQuote - firstQuote - 1).Trim();
    }

    private async Task<(string title, string url)> GetContentInfoAsync(string contentType, int contentId)
    {
        switch (contentType)
        {
            case "Song":
                var song = await _context.Songs
                    .Include(s => s.SongArtists)
                        .ThenInclude(sa => sa.Artist)
                    .FirstOrDefaultAsync(s => s.Id == contentId);

                if (song != null)
                {
                    var artistNames = string.Join(", ", song.SongArtists.Select(sa =>
                        sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown"
                    ));
                    return ($"{song.Title} - {artistNames}", $"/song/{song.Id}");
                }
                break;

            case "Article":
            case "BlogPost":
                var article = await _context.Articles
                    .FirstOrDefaultAsync(a => a.Id == contentId);

                if (article != null)
                {
                    var route = article.ContentType == 0 ? "news" : "blog";
                    return (article.Title, $"/{route}/{article.Slug}");
                }
                break;

            case "General":
                return ("הודעה כללית למערכת", "/");

            case "Genre":
                var genre = await _context.Genres
                    .FirstOrDefaultAsync(g => g.Id == contentId);

                if (genre != null)
                {
                    return (genre.Name, $"/admin/genres");
                }
                break;

            case "Tag":
                var tag = await _context.Tags
                    .FirstOrDefaultAsync(t => t.Id == contentId);

                if (tag != null)
                {
                    return (tag.Name, $"/admin/tags");
                }
                break;

            case "Person":
                var person = await _context.People
                    .FirstOrDefaultAsync(p => p.Id == contentId);

                if (person != null)
                {
                    return (person.Name, $"/admin/people");
                }
                break;
        }

        return ("תוכן לא נמצא", "#");
    }

    private static (string SongName, string ArtistName) ParseChordRequest(string description)
    {
        var songMatch = Regex.Match(description, @"(?:שיר|לשיר)\s*:\s*(.+?)(?:\s*[—-]\s*אמן\s*:|$)");
        var artistMatch = Regex.Match(description, @"אמן\s*:\s*(.+)$");

        var songName = songMatch.Success ? songMatch.Groups[1].Value.Trim() : string.Empty;
        var artistName = artistMatch.Success ? artistMatch.Groups[1].Value.Trim() : string.Empty;

        return (songName, artistName);
    }

    private static string NormalizeRequestText(string value)
    {
        var cleaned = value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ')
            .ToArray();

        return Regex.Replace(new string(cleaned), @"\s+", " ").Trim();
    }

    private async Task<bool> IsAdminOrManagerAsync(int userId)
    {
        return await _context.Users
            .AnyAsync(u => u.Id == userId &&
                           !u.IsDeleted &&
                           u.IsActive &&
                           (u.Role == UserRole.Admin || u.Role == UserRole.Manager));
    }

    private static bool IsChordRequestAdminOnly(ContentReport report)
    {
        return report.AdminNotes?.Contains(ChordRequestAdminOnlyMarker) == true;
    }

    private static string MergeAdminOnlyMarker(string? notes)
    {
        if (notes?.Contains(ChordRequestAdminOnlyMarker) == true)
        {
            return notes;
        }

        return string.IsNullOrWhiteSpace(notes)
            ? ChordRequestAdminOnlyMarker
            : $"{ChordRequestAdminOnlyMarker} {notes}";
    }

    private static string? RemoveAdminOnlyMarker(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
        {
            return notes;
        }

        var cleaned = notes.Replace(ChordRequestAdminOnlyMarker, string.Empty).Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static List<string> ExtractRequestTokens(string value)
    {
        return NormalizeRequestText(value)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => token.Length >= 2)
            .Distinct()
            .ToList();
    }

    private static int ScoreRequestText(string query, string candidate)
    {
        if (string.IsNullOrWhiteSpace(query) || string.IsNullOrWhiteSpace(candidate))
        {
            return 0;
        }

        if (query == candidate)
        {
            return 100;
        }

        if (candidate.StartsWith(query) || query.StartsWith(candidate))
        {
            return 88;
        }

        if (candidate.Contains(query) || query.Contains(candidate))
        {
            return 76;
        }

        var queryTokens = ExtractRequestTokens(query);
        var candidateTokens = ExtractRequestTokens(candidate);
        if (queryTokens.Count == 0 || candidateTokens.Count == 0)
        {
            return 0;
        }

        var commonTokens = queryTokens.Intersect(candidateTokens).Count();
        if (commonTokens == 0)
        {
            return 0;
        }

        var coverage = (int)Math.Round((double)commonTokens / queryTokens.Count * 70);
        var closenessBonus = queryTokens.Any(token =>
            candidateTokens.Any(candidateToken =>
                candidateToken.StartsWith(token) || token.StartsWith(candidateToken)))
            ? 14
            : 0;

        return coverage + closenessBonus;
    }

    private async Task SendReportNotificationEmailAsync(ContentReport report)
    {
        // TODO: Implement email sending to admins
        // This should:
        // 1. Get all admin emails from Users table where Role = Admin
        // 2. Compose email with report details
        // 3. Send email using email service (SendGrid, SMTP, etc.)
        // 4. Log the notification

        await Task.CompletedTask; // Placeholder
    }
}
