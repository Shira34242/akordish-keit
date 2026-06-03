using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using AkordishKeit.Models.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

public class SongService : ISongService
{
    private readonly AkordishKeitDbContext _context;
    private readonly IYouTubeService _youTubeService;
    private readonly INotificationService _notificationService;
    private readonly IChordIndexService _chordIndexService;
    private readonly IMemoryCache _cache;

    public SongService(
        AkordishKeitDbContext context,
        IYouTubeService youTubeService,
        INotificationService notificationService,
        IChordIndexService chordIndexService,
        IMemoryCache cache)
    {
        _context = context;
        _youTubeService = youTubeService;
        _notificationService = notificationService;
        _chordIndexService = chordIndexService;
        _cache = cache;
    }

    private async Task<string?> StoreYouTubeThumbnailIfNeededAsync(string? imageUrl)
    {
        if (!IsYouTubeThumbnailUrl(imageUrl))
            return imageUrl;

        return await _youTubeService.StoreYouTubeThumbnailAsync(imageUrl!) ?? imageUrl;
    }

    private static bool IsYouTubeThumbnailUrl(string? url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Host.Equals("img.youtube.com", StringComparison.OrdinalIgnoreCase)
                || uri.Host.Equals("i.ytimg.com", StringComparison.OrdinalIgnoreCase));
    }

    // ============================================
    // HIGH PRIORITY - Core CRUD Operations
    // ============================================

    public async Task<AddSongResponseDto> CreateSongAsync(AddSongRequestDto dto, int userId)
    {
        if (dto.IsApproved)
        {
            var missingRequired = new List<string>();
            if (string.IsNullOrWhiteSpace(dto.YoutubeUrl)) missingRequired.Add("קישור YouTube");
            else if (!Regex.IsMatch(dto.YoutubeUrl, @"^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$", RegexOptions.IgnoreCase))
                missingRequired.Add("קישור YouTube תקין");
            if (string.IsNullOrWhiteSpace(dto.LyricsWithChords) || dto.LyricsWithChords.Length < 10) missingRequired.Add("מילים ואקורדים");
            if (dto.OriginalKeyId <= 0) missingRequired.Add("סולם מקורי");

            if (missingRequired.Count > 0)
            {
                return new AddSongResponseDto
                {
                    Success = false,
                    Message = $"חסרים שדות לפרסום: {string.Join(", ", missingRequired)}"
                };
            }
        }

        if (dto.OriginalKeyId <= 0)
        {
            dto.OriginalKeyId = 1;
        }

        // Fetch YouTube metadata BEFORE opening the transaction — external HTTP calls must not hold a DB connection
        string? imageUrl = dto.ImageUrl;
        int? durationSeconds = null;

        if (!string.IsNullOrEmpty(dto.YoutubeUrl))
        {
            var youtubeMetadata = await _youTubeService.GetVideoMetadataAsync(dto.YoutubeUrl);
            if (youtubeMetadata.Success && string.IsNullOrEmpty(imageUrl))
            {
                imageUrl = youtubeMetadata.ThumbnailUrl;
            }
            durationSeconds = youtubeMetadata.DurationSeconds;
        }

        imageUrl = await StoreYouTubeThumbnailIfNeededAsync(imageUrl);

        // Use transaction to ensure atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Validate existing artists (only those with ID)
            var existingArtists = dto.Artists.Where(a => a.Id.HasValue).ToList();

            // Reject duplicate artist IDs in the same submission
            var artistIds = existingArtists.Select(a => a.Id!.Value).ToList();
            if (artistIds.Count != artistIds.Distinct().Count())
            {
                return new AddSongResponseDto { Success = false, Message = "לא ניתן להוסיף אותו אמן פעמיים" };
            }

            foreach (var artist in existingArtists)
            {
                var artistExists = await _context.Artists
                    .AnyAsync(a => a.Id == artist.Id!.Value && !a.IsDeleted);

                if (!artistExists)
                {
                    return new AddSongResponseDto
                    {
                        Success = false,
                        Message = $"אמן עם ID {artist.Id} לא קיים במערכת"
                    };
                }
            }

            // 3. Handle composer/lyricist/arranger - create new if doesn't exist
            int? composerId = await GetOrCreatePersonAsync(dto.Composer, userId);
            int? lyricistId = await GetOrCreatePersonAsync(dto.Lyricist, userId);
            int? arrangerId = await GetOrCreatePersonAsync(dto.Arranger, userId);

            var uploader = await NormalizeUploaderAsync(
                userId,
                dto.UploaderUserId,
                dto.UploaderProfileType,
                dto.UploaderProfileId);

            // 4. Create the song entity
            var song = new Song
            {
                Title = dto.Title.Trim(),
                LyricsWithChords = dto.LyricsWithChords,
                OriginalKeyId = dto.OriginalKeyId,
                EasyKeyId = dto.EasyKeyId,
                YouTubeUrl = dto.YoutubeUrl.Trim(),
                SpotifyUrl = dto.SpotifyUrl?.Trim(),
                ImageUrl = imageUrl ?? "default-song-image.jpg",
                SheetMusicUrl = string.IsNullOrWhiteSpace(dto.SheetMusicUrl) ? null : dto.SheetMusicUrl.Trim(),
                ComposerId = composerId,
                LyricistId = lyricistId,
                ArrangerId = arrangerId,
                DurationSeconds = durationSeconds,
                UploadedByUserId = userId,
                UploaderUserId = uploader.UserId,
                UploaderProfileType = uploader.ProfileType,
                UploaderProfileId = uploader.ProfileId,
                IsApproved = dto.IsApproved,
                ViewCount = 0,
                PlayCount = 0,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Songs.Add(song);
            await _context.SaveChangesAsync();

            // 4. Add artists with order (support both existing and new artists)
            for (int i = 0; i < dto.Artists.Count; i++)
            {
                var artist = dto.Artists[i];

                if (artist.Id.HasValue)
                {
                    // Existing artist
                    _context.SongArtists.Add(new SongArtist
                    {
                        SongId = song.Id,
                        ArtistId = artist.Id.Value,
                        Order = i + 1,
                        IsTemporary = false
                    });
                }
                else
                {
                    // New artist - save as temporary
                    _context.SongArtists.Add(new SongArtist
                    {
                        SongId = song.Id,
                        ArtistId = null,
                        TempArtistName = artist.Name.Trim(),
                        Order = i + 1,
                        IsTemporary = true
                    });

                    // Create a report for admin review
                    _context.ContentReports.Add(new ContentReport
                    {
                        UserId = userId,
                        ContentType = "Song",
                        ContentId = song.Id,
                        ReportType = "NewArtist",
                        Description = $"נוסף שיר עם אמן שלא קיים במערכת: '{artist.Name}' בשיר '{song.Title}'",
                        ReportedAt = DateTime.UtcNow,
                        Status = "Pending"
                    });
                }
            }

            // 5. Add genres - support new and existing
            if (dto.Genres != null && dto.Genres.Any())
            {
                foreach (var genreInput in dto.Genres)
                {
                    int genreId;

                    if (genreInput.Id.HasValue)
                    {
                        // Existing genre - validate it exists
                        genreId = genreInput.Id.Value;
                        if (!await _context.Genres.AnyAsync(g => g.Id == genreId))
                        {
                            continue; // Skip invalid genre
                        }
                    }
                    else
                    {
                        // New genre - check for duplicate (case-insensitive)
                        var normalizedName = genreInput.Name.Trim();
                        var existingGenre = await _context.Genres
                            .FirstOrDefaultAsync(g => g.Name.ToLower() == normalizedName.ToLower());

                        if (existingGenre != null)
                        {
                            // Already exists - use existing
                            genreId = existingGenre.Id;
                        }
                        else
                        {
                            // Create new genre
                            var newGenre = new Genre { Name = normalizedName };
                            _context.Genres.Add(newGenre);
                            await _context.SaveChangesAsync();
                            genreId = newGenre.Id;

                            // Create report for admin review
                            _context.ContentReports.Add(new ContentReport
                            {
                                UserId = userId,
                                ContentType = "Genre",
                                ContentId = genreId,
                                ReportType = "NewGenre",
                                Description = $"נוצר ז'אנר חדש: '{newGenre.Name}' בשיר '{song.Title}'",
                                ReportedAt = DateTime.UtcNow,
                                Status = "Pending"
                            });
                        }
                    }

                    _context.SongGenres.Add(new SongGenre
                    {
                        SongId = song.Id,
                        GenreId = genreId
                    });
                }
            }

            // 6. Add tags - support new and existing
            if (dto.Tags != null && dto.Tags.Any())
            {
                foreach (var tagInput in dto.Tags)
                {
                    int tagId;

                    if (tagInput.Id.HasValue)
                    {
                        // Existing tag - validate it exists
                        tagId = tagInput.Id.Value;
                        if (!await _context.Tags.AnyAsync(t => t.Id == tagId))
                        {
                            continue; // Skip invalid tag
                        }
                    }
                    else
                    {
                        // New tag - check for duplicate (case-insensitive)
                        var normalizedName = tagInput.Name.Trim();
                        var existingTag = await _context.Tags
                            .FirstOrDefaultAsync(t => t.Name.ToLower() == normalizedName.ToLower());

                        if (existingTag != null)
                        {
                            // Already exists - use existing
                            tagId = existingTag.Id;
                        }
                        else
                        {
                            // Create new tag
                            var newTag = new Tag { Name = normalizedName };
                            _context.Tags.Add(newTag);
                            await _context.SaveChangesAsync();
                            tagId = newTag.Id;

                            // Create report for admin review
                            _context.ContentReports.Add(new ContentReport
                            {
                                UserId = userId,
                                ContentType = "Tag",
                                ContentId = tagId,
                                ReportType = "NewTag",
                                Description = $"נוצרה תגית חדשה: '{newTag.Name}' בשיר '{song.Title}'",
                                ReportedAt = DateTime.UtcNow,
                                Status = "Pending"
                            });
                        }
                    }

                    _context.SongTags.Add(new SongTag
                    {
                        SongId = song.Id,
                        TagId = tagId
                    });
                }
            }

            // 7. Create content submission
            var submission = new ContentSubmission
            {
                SongId = song.Id,
                Status = dto.IsApproved ? SubmissionStatus.Approved : SubmissionStatus.Pending,
                SubmittedByUserId = userId,
                SubmittedAt = DateTime.UtcNow,
                ReviewedAt = dto.IsApproved ? DateTime.UtcNow : null
            };

            _context.ContentSubmissions.Add(submission);

            await _chordIndexService.SyncSongChordsAsync(song.Id, song.LyricsWithChords);

            // Save all changes within transaction
            await _context.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            await _notificationService.NotifySongSubmittedAsync(userId, song.Id, song.Title);

            return new AddSongResponseDto
            {
                Success = true,
                Message = "השיר הוגש בהצלחה! ממתין לאישור מנהל.",
                SongId = song.Id,
                SubmissionId = submission.Id,
                IsApproved = false
            };
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync();
            return new AddSongResponseDto
            {
                Success = false,
                Message = ex.Message
            };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine($"Error creating song: {ex.Message}");

            return new AddSongResponseDto
            {
                Success = false,
                Message = "אירעה שגיאה בהוספת השיר"
            };
        }
    }

    public async Task<AddSongResponseDto> UpdateSongAsync(int id, UpdateSongRequestDto dto, int userId)
    {
        // Use transaction to ensure atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Fetch the song with all relationships
            var song = await _context.Songs
                .Include(s => s.SongArtists)
                .Include(s => s.SongGenres)
                .Include(s => s.SongTags)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (song == null)
            {
                return new AddSongResponseDto
                {
                    Success = false,
                    Message = "השיר לא נמצא"
                };
            }

            // 2. Check permissions
            var currentUser = await _context.Users.FindAsync(userId);
            if (currentUser == null)
            {
                return new AddSongResponseDto
                {
                    Success = false,
                    Message = "משתמש לא נמצא"
                };
            }

            bool isAdmin = currentUser.Role == UserRole.Admin || currentUser.Role == UserRole.Manager;
            bool isUploader = song.UploadedByUserId == userId;

            if (!isAdmin && !isUploader)
            {
                return new AddSongResponseDto
                {
                    Success = false,
                    Message = "אין לך הרשאה לערוך שיר זה"
                };
            }

            var uploader = await NormalizeUploaderAsync(
                userId,
                dto.UploaderUserId,
                dto.UploaderProfileType,
                dto.UploaderProfileId);

            // 3. Update basic fields
            song.Title = dto.Title.Trim();
            song.LyricsWithChords = dto.LyricsWithChords;
            song.OriginalKeyId = dto.OriginalKeyId;
            song.EasyKeyId = dto.EasyKeyId;
            song.YouTubeUrl = dto.YoutubeUrl.Trim();
            song.SpotifyUrl = dto.SpotifyUrl?.Trim();
            song.ImageUrl = await StoreYouTubeThumbnailIfNeededAsync(dto.ImageUrl) ?? song.ImageUrl;
            song.SheetMusicUrl = string.IsNullOrWhiteSpace(dto.SheetMusicUrl) ? null : dto.SheetMusicUrl.Trim();
            song.ComposerId = await GetOrCreatePersonAsync(dto.Composer, userId);
            song.LyricistId = await GetOrCreatePersonAsync(dto.Lyricist, userId);
            song.ArrangerId = await GetOrCreatePersonAsync(dto.Arranger, userId);
            song.UploaderUserId = uploader.UserId;
            song.UploaderProfileType = uploader.ProfileType;
            song.UploaderProfileId = uploader.ProfileId;
            song.IsApproved = dto.IsApproved;
            song.UpdatedAt = DateTime.UtcNow;

            // 4. Update artists - remove and re-add (support both existing and new artists)
            _context.SongArtists.RemoveRange(song.SongArtists);
            for (int i = 0; i < dto.Artists.Count; i++)
            {
                var artist = dto.Artists[i];

                if (artist.Id.HasValue)
                {
                    // Existing artist
                    _context.SongArtists.Add(new SongArtist
                    {
                        SongId = song.Id,
                        ArtistId = artist.Id.Value,
                        Order = i + 1,
                        IsTemporary = false
                    });
                }
                else
                {
                    // New artist - save as temporary
                    _context.SongArtists.Add(new SongArtist
                    {
                        SongId = song.Id,
                        ArtistId = null,
                        TempArtistName = artist.Name.Trim(),
                        Order = i + 1,
                        IsTemporary = true
                    });

                    // Create a report for admin review
                    _context.ContentReports.Add(new ContentReport
                    {
                        UserId = userId,
                        ContentType = "Song",
                        ContentId = song.Id,
                        ReportType = "NewArtist",
                        Description = $"עודכן שיר עם אמן שלא קיים במערכת: '{artist.Name}' בשיר '{song.Title}'",
                        ReportedAt = DateTime.UtcNow,
                        Status = "Pending"
                    });
                }
            }

            // 5. Update genres - remove and re-add, support new genres
            _context.SongGenres.RemoveRange(song.SongGenres);
            if (dto.Genres != null && dto.Genres.Any())
            {
                foreach (var genreInput in dto.Genres)
                {
                    int genreId;

                    if (genreInput.Id.HasValue)
                    {
                        // Existing genre - validate it exists
                        genreId = genreInput.Id.Value;
                        if (!await _context.Genres.AnyAsync(g => g.Id == genreId))
                        {
                            continue; // Skip invalid genre
                        }
                    }
                    else
                    {
                        // New genre - check for duplicate (case-insensitive)
                        var normalizedName = genreInput.Name.Trim();
                        var existingGenre = await _context.Genres
                            .FirstOrDefaultAsync(g => g.Name.ToLower() == normalizedName.ToLower());

                        if (existingGenre != null)
                        {
                            // Already exists - use existing
                            genreId = existingGenre.Id;
                        }
                        else
                        {
                            // Create new genre
                            var newGenre = new Genre { Name = normalizedName };
                            _context.Genres.Add(newGenre);
                            await _context.SaveChangesAsync();
                            genreId = newGenre.Id;

                            // Create report for admin review
                            _context.ContentReports.Add(new ContentReport
                            {
                                UserId = userId,
                                ContentType = "Genre",
                                ContentId = genreId,
                                ReportType = "NewGenre",
                                Description = $"נוצר ז'אנר חדש: '{newGenre.Name}' בעדכון שיר '{song.Title}'",
                                ReportedAt = DateTime.UtcNow,
                                Status = "Pending"
                            });
                        }
                    }

                    _context.SongGenres.Add(new SongGenre
                    {
                        SongId = song.Id,
                        GenreId = genreId
                    });
                }
            }

            // 6. Update tags - remove and re-add, support new tags
            _context.SongTags.RemoveRange(song.SongTags);
            if (dto.Tags != null && dto.Tags.Any())
            {
                foreach (var tagInput in dto.Tags)
                {
                    int tagId;

                    if (tagInput.Id.HasValue)
                    {
                        // Existing tag - validate it exists
                        tagId = tagInput.Id.Value;
                        if (!await _context.Tags.AnyAsync(t => t.Id == tagId))
                        {
                            continue; // Skip invalid tag
                        }
                    }
                    else
                    {
                        // New tag - check for duplicate (case-insensitive)
                        var normalizedName = tagInput.Name.Trim();
                        var existingTag = await _context.Tags
                            .FirstOrDefaultAsync(t => t.Name.ToLower() == normalizedName.ToLower());

                        if (existingTag != null)
                        {
                            // Already exists - use existing
                            tagId = existingTag.Id;
                        }
                        else
                        {
                            // Create new tag
                            var newTag = new Tag { Name = normalizedName };
                            _context.Tags.Add(newTag);
                            await _context.SaveChangesAsync();
                            tagId = newTag.Id;

                            // Create report for admin review
                            _context.ContentReports.Add(new ContentReport
                            {
                                UserId = userId,
                                ContentType = "Tag",
                                ContentId = tagId,
                                ReportType = "NewTag",
                                Description = $"נוצרה תגית חדשה: '{newTag.Name}' בעדכון שיר '{song.Title}'",
                                ReportedAt = DateTime.UtcNow,
                                Status = "Pending"
                            });
                        }
                    }

                    _context.SongTags.Add(new SongTag
                    {
                        SongId = song.Id,
                        TagId = tagId
                    });
                }
            }

            await _chordIndexService.SyncSongChordsAsync(song.Id, song.LyricsWithChords);

            var submission = await _context.ContentSubmissions
                .Where(cs => cs.SongId == song.Id && !cs.IsDeleted)
                .OrderByDescending(cs => cs.SubmittedAt)
                .FirstOrDefaultAsync();

            if (submission != null)
            {
                submission.Status = dto.IsApproved ? SubmissionStatus.Approved : SubmissionStatus.Pending;
                submission.ReviewedAt = DateTime.UtcNow;
            }

            // Save all changes within transaction
            await _context.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            return new AddSongResponseDto
            {
                Success = true,
                Message = "השיר עודכן בהצלחה",
                SongId = song.Id,
                IsApproved = song.IsApproved
            };
        }
        catch (InvalidOperationException ex)
        {
            await transaction.RollbackAsync();
            return new AddSongResponseDto
            {
                Success = false,
                Message = ex.Message
            };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine($"Error updating song: {ex.Message}");

            return new AddSongResponseDto
            {
                Success = false,
                Message = "אירעה שגיאה בעדכון השיר"
            };
        }
    }

    public async Task<PagedResult<SongDto>> GetSongsAsync(
        int page,
        int pageSize,
        string? search = null,
        int? artistId = null,
        int? genreId = null,
        int? keyId = null,
        int? tagId = null,
        string? sortBy = null,
        bool includeUnapproved = false,
        string? uploaderSearch = null,
        DateTime? dateFrom = null,
        DateTime? dateTo = null,
        bool? isApproved = null)
    {
        try
        {
            var query = _context.Songs
                .Where(s => !s.IsDeleted && (includeUnapproved || s.IsApproved))
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
                .Include(s => s.OriginalKey)
                .Include(s => s.EasyKey)
                .Include(s => s.Composer)
                .Include(s => s.Lyricist)
                .Include(s => s.Arranger)
                .Include(s => s.SongGenres)
                    .ThenInclude(sg => sg.Genre)
                .Include(s => s.SongTags)
                    .ThenInclude(st => st.Tag)
                .AsQueryable();

            // Apply filters
            if (artistId.HasValue)
            {
                query = query.Where(s => s.SongArtists.Any(sa => sa.ArtistId == artistId.Value));
            }

            if (genreId.HasValue)
            {
                query = query.Where(s => s.SongGenres.Any(sg => sg.GenreId == genreId.Value));
            }

            if (keyId.HasValue)
            {
                query = query.Where(s => s.OriginalKeyId == keyId.Value);
            }

            if (tagId.HasValue)
            {
                query = query.Where(s => s.SongTags.Any(st => st.TagId == tagId.Value));
            }

            if (!string.IsNullOrWhiteSpace(uploaderSearch))
            {
                var uploaderPattern = $"%{uploaderSearch.Trim()}%";
                query = query.Where(s =>
                    s.UploaderUser != null &&
                    (EF.Functions.Like(s.UploaderUser.Username, uploaderPattern) ||
                     EF.Functions.Like(s.UploaderUser.Email, uploaderPattern) ||
                     (s.UploaderUser.ManagedArtist != null && EF.Functions.Like(s.UploaderUser.ManagedArtist.Name, uploaderPattern)) ||
                     s.UploaderUser.ServiceProviderProfiles.Any(profile => EF.Functions.Like(profile.DisplayName, uploaderPattern))));
            }

            if (dateFrom.HasValue)
            {
                query = query.Where(s => s.CreatedAt >= dateFrom.Value.Date);
            }

            if (dateTo.HasValue)
            {
                var exclusiveDateTo = dateTo.Value.Date.AddDays(1);
                query = query.Where(s => s.CreatedAt < exclusiveDateTo);
            }

            if (isApproved.HasValue)
            {
                query = query.Where(s => s.IsApproved == isApproved.Value);
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(s =>
                    s.Title.Contains(search) ||
                    s.SongArtists.Any(sa =>
                        (sa.Artist != null && sa.Artist.Name.Contains(search)) ||
                        (sa.TempArtistName != null && sa.TempArtistName.Contains(search))
                    )
                );
            }

            // Sorting
            query = sortBy switch
            {
                "views" or "popularity" => query.OrderByDescending(s => s.ViewCount),
                "name" => query.OrderBy(s => s.Title),
                "artist" => query.OrderBy(s => s.SongArtists
                    .OrderBy(sa => sa.Order)
                    .Select(sa => sa.Artist != null ? sa.Artist.Name : sa.TempArtistName)
                    .FirstOrDefault()).ThenBy(s => s.Title),
                "uploader" => query.OrderBy(s => s.UploaderUser != null ? s.UploaderUser.Username : string.Empty).ThenBy(s => s.Title),
                "date_asc" => query.OrderBy(s => s.CreatedAt),
                _ => query.OrderByDescending(s => s.BumpedAt ?? s.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var songs = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new SongDto
                {
                    Id = s.Id,
                    Title = s.Title,

                    Artists = s.SongArtists
                        .OrderBy(sa => sa.Order)
                        .Select(sa => new ArtistBasicDto
                        {
                            Id = sa.Artist != null ? sa.Artist.Id : 0,  // 0 for temporary artists
                            Name = sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown",
                            EnglishName = sa.Artist != null ? sa.Artist.EnglishName : null,
                            ImageUrl = sa.Artist != null ? sa.Artist.ImageUrl : null
                        })
                        .ToList(),

                    LyricsWithChords = s.LyricsWithChords,
                    OriginalKeyId = s.OriginalKeyId,
                    OriginalKeyName = s.OriginalKey.Name,
                    EasyKeyId = s.EasyKeyId,
                    EasyKeyName = s.EasyKey != null ? s.EasyKey.Name : null,
                    YoutubeUrl = s.YouTubeUrl,
                    SpotifyUrl = s.SpotifyUrl,
                    ImageUrl = s.ImageUrl,
                    SheetMusicUrl = s.SheetMusicUrl,

                    Composer = s.Composer != null ? new PersonBasicDto
                    {
                        Id = s.Composer.Id,
                        Name = s.Composer.Name,
                        EnglishName = s.Composer.EnglishName
                    } : null,

                    Lyricist = s.Lyricist != null ? new PersonBasicDto
                    {
                        Id = s.Lyricist.Id,
                        Name = s.Lyricist.Name,
                        EnglishName = s.Lyricist.EnglishName
                    } : null,

                    Arranger = s.Arranger != null ? new PersonBasicDto
                    {
                        Id = s.Arranger.Id,
                        Name = s.Arranger.Name,
                        EnglishName = s.Arranger.EnglishName
                    } : null,

                    Genres = s.SongGenres
                        .Select(sg => new GenreDto
                        {
                            Id = sg.Genre.Id,
                            Name = sg.Genre.Name
                        })
                        .ToList(),

                    Tags = s.SongTags
                        .Select(st => new TagDto
                        {
                            Id = st.Tag.Id,
                            Name = st.Tag.Name
                        })
                        .ToList(),

                    IsApproved = s.IsApproved,
                    ViewCount = s.ViewCount,
                    PlayCount = s.PlayCount,
                    Language = s.Language,
                    DurationSeconds = s.DurationSeconds,
                    CreatedAt = s.CreatedAt,
                    UpdatedAt = s.UpdatedAt,
                    BumpedAt = s.BumpedAt,
                    BumpCount = s.BumpCount,
                    UploadedByUserId = s.UploadedByUserId,
                    UploaderUserId = s.UploaderUserId,
                    UploaderProfileType = s.UploaderProfileType,
                    UploaderProfileId = s.UploaderProfileId,
                    RatingCount = s.Ratings.Count(),
                    AverageRating = Math.Round(s.Ratings.Average(r => (double?)r.Rating) ?? 0, 1)
                })
                .ToListAsync();

            return new PagedResult<SongDto>
            {
                Items = songs,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting songs: {ex.Message}");
            throw;
        }
    }

    public async Task<SongDto?> GetSongByIdAsync(int id, bool includeUnapproved = false)
    {
        try
        {
            var song = await _context.Songs
                .Where(s => s.Id == id && !s.IsDeleted && (includeUnapproved || s.IsApproved))
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
                .Include(s => s.OriginalKey)
                .Include(s => s.EasyKey)
                .Include(s => s.Composer)
                .Include(s => s.Lyricist)
                .Include(s => s.Arranger)
                .Include(s => s.SongGenres)
                    .ThenInclude(sg => sg.Genre)
                .Include(s => s.SongTags)
                    .ThenInclude(st => st.Tag)
                .Include(s => s.UploaderUser)
                    .ThenInclude(u => u!.ManagedArtist)
                .Include(s => s.UploaderUser)
                    .ThenInclude(u => u!.ServiceProviderProfiles)
                .FirstOrDefaultAsync();

            if (song == null)
            {
                return null;
            }

            return new SongDto
            {
                Id = song.Id,
                Title = song.Title,

                Artists = song.SongArtists
                    .OrderBy(sa => sa.Order)
                    .Select(sa => new ArtistBasicDto
                    {
                        Id = sa.Artist != null ? sa.Artist.Id : 0,
                        Name = sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown",
                        EnglishName = sa.Artist?.EnglishName,
                        ImageUrl = sa.Artist?.ImageUrl
                    })
                    .ToList(),

                LyricsWithChords = song.LyricsWithChords,
                OriginalKeyId = song.OriginalKeyId,
                OriginalKeyName = song.OriginalKey.Name,
                EasyKeyId = song.EasyKeyId,
                EasyKeyName = song.EasyKey?.Name,
                YoutubeUrl = song.YouTubeUrl,
                SpotifyUrl = song.SpotifyUrl,
                ImageUrl = song.ImageUrl,
                SheetMusicUrl = song.SheetMusicUrl,

                Composer = song.Composer != null ? new PersonBasicDto
                {
                    Id = song.Composer.Id,
                    Name = song.Composer.Name,
                    EnglishName = song.Composer.EnglishName
                } : null,

                Lyricist = song.Lyricist != null ? new PersonBasicDto
                {
                    Id = song.Lyricist.Id,
                    Name = song.Lyricist.Name,
                    EnglishName = song.Lyricist.EnglishName
                } : null,

                Arranger = song.Arranger != null ? new PersonBasicDto
                {
                    Id = song.Arranger.Id,
                    Name = song.Arranger.Name,
                    EnglishName = song.Arranger.EnglishName
                } : null,

                Genres = song.SongGenres
                    .Select(sg => new GenreDto
                    {
                        Id = sg.Genre.Id,
                        Name = sg.Genre.Name
                    })
                    .ToList(),

                Tags = song.SongTags
                    .Select(st => new TagDto
                    {
                        Id = st.Tag.Id,
                        Name = st.Tag.Name
                    })
                    .ToList(),

                IsApproved = song.IsApproved,
                ViewCount = song.ViewCount,
                PlayCount = song.PlayCount,
                Language = song.Language,
                DurationSeconds = song.DurationSeconds,
                CreatedAt = song.CreatedAt,
                UpdatedAt = song.UpdatedAt,
                BumpedAt = song.BumpedAt,
                UploadedByUserId = song.UploadedByUserId,
                UploaderUserId = song.UploaderUserId,
                UploaderProfileType = song.UploaderProfileType,
                UploaderProfileId = song.UploaderProfileId,
                UploaderProfile = ResolveUploaderProfile(song.UploaderUser, song.UploaderProfileType, song.UploaderProfileId)
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting song by ID: {ex.Message}");
            throw;
        }
    }

    private async Task EnsureValidSongArtistsAsync(IEnumerable<int>? artistIds)
    {
        var ids = artistIds?.Distinct().ToList() ?? new List<int>();
        if (ids.Count == 0) return;

        var existingIds = await _context.Artists
            .Where(a => !a.IsDeleted && ids.Contains(a.Id))
            .Select(a => a.Id)
            .ToListAsync();

        var missingIds = ids.Except(existingIds).ToList();
        if (missingIds.Count > 0)
        {
            throw new InvalidOperationException("אחד האמנים שנבחרו לא נמצא");
        }
    }

    private async Task<List<int>> BuildSongArtistIdsForModeAsync(
        IEnumerable<int> currentArtistIds,
        IEnumerable<int>? requestedArtistIds,
        string? mode)
    {
        var requestedIds = requestedArtistIds?.Distinct().ToList() ?? new List<int>();
        if (requestedIds.Count == 0)
        {
            throw new InvalidOperationException("נא לבחור לפחות אמן אחד");
        }

        await EnsureValidSongArtistsAsync(requestedIds);

        var normalizedMode = string.IsNullOrWhiteSpace(mode) ? "replace" : mode.Trim().ToLowerInvariant();
        var currentIds = currentArtistIds.Distinct().ToList();

        return normalizedMode switch
        {
            "add" => currentIds.Union(requestedIds).Distinct().ToList(),
            "remove" => currentIds.Except(requestedIds).Distinct().ToList(),
            _ => requestedIds
        };
    }

    private async Task<(int? UserId, string? ProfileType, int? ProfileId)> NormalizeUploaderAsync(
        int currentUserId,
        int? requestedUserId,
        string? requestedProfileType,
        int? requestedProfileId)
    {
        var currentUser = await _context.Users.FindAsync(currentUserId);
        if (currentUser == null)
        {
            throw new InvalidOperationException("׳׳©׳×׳׳© ׳׳ ׳ ׳׳¦׳");
        }

        var isAdmin = currentUser.Role == UserRole.Admin || currentUser.Role == UserRole.Manager;
        var profileType = NormalizeProfileType(requestedProfileType);
        int? uploaderUserId = isAdmin ? requestedUserId ?? currentUserId : currentUserId;
        var profileId = requestedProfileId;

        if (isAdmin && profileId.HasValue && profileType != null)
        {
            var profileOwnerUserId = await GetProfileOwnerUserIdAsync(profileType, profileId.Value);
            if (requestedUserId.HasValue && profileOwnerUserId.HasValue && requestedUserId.Value != profileOwnerUserId.Value)
            {
                throw new InvalidOperationException("הפרופיל שנבחר לא שייך למשתמש שנבחר");
            }

            var profileExists = await ProfileExistsAsync(profileType, profileId.Value);
            if (!profileExists)
            {
                throw new InvalidOperationException("הפרופיל שנבחר לא נמצא");
            }

            return (profileOwnerUserId ?? requestedUserId, profileType, profileId);
        }

        if (profileType == null)
        {
            return (uploaderUserId, null, null);
        }

        if (!uploaderUserId.HasValue)
        {
            return (null, null, null);
        }

        profileId ??= await GetDefaultProfileIdForUserAsync(uploaderUserId.Value, profileType);
        if (!profileId.HasValue)
        {
            return (uploaderUserId, null, null);
        }

        var belongsToUser = await ProfileBelongsToUserAsync(uploaderUserId.Value, profileType, profileId.Value);
        if (!belongsToUser)
        {
            throw new InvalidOperationException("׳”׳₪׳¨׳•׳₪׳™׳ ׳©׳ ׳‘׳—׳¨ ׳׳ ׳©׳™׳™׳ ׳׳׳©׳×׳׳© ׳”׳׳¢׳׳”");
        }

        return (uploaderUserId, profileType, profileId);
    }

    private static string? NormalizeProfileType(string? profileType)
    {
        if (string.IsNullOrWhiteSpace(profileType)) return null;
        return profileType == "artist" || profileType == "serviceProvider" ? profileType : null;
    }

    private async Task<int?> GetProfileOwnerUserIdAsync(string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .Where(a => !a.IsDeleted && a.Id == profileId)
                .Select(a => a.UserId)
                .FirstOrDefaultAsync();
        }

        return await _context.ServiceProviders
            .Where(p => !p.IsDeleted && p.Id == profileId)
            .Select(p => p.UserId)
            .FirstOrDefaultAsync();
    }

    private async Task<int?> GetDefaultProfileIdForUserAsync(int userId, string profileType)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .Where(a => !a.IsDeleted && a.UserId == userId)
                .OrderByDescending(a => a.Status == ArtistStatus.Active)
                .Select(a => (int?)a.Id)
                .FirstOrDefaultAsync();
        }

        return await _context.ServiceProviders
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ThenByDescending(p => p.Status == ProfileStatus.Active)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<bool> ProfileBelongsToUserAsync(int userId, string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .AnyAsync(a => !a.IsDeleted && a.Id == profileId && a.UserId == userId);
        }

        return await _context.ServiceProviders
            .AnyAsync(p => !p.IsDeleted && p.Id == profileId && p.UserId == userId);
    }

    private async Task<bool> ProfileExistsAsync(string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .AnyAsync(a => !a.IsDeleted && a.Id == profileId);
        }

        return await _context.ServiceProviders
            .AnyAsync(p => !p.IsDeleted && p.Id == profileId);
    }

    private ContentUploaderProfileDto? ResolveUploaderProfile(User? user, string? profileType, int? profileId)
    {
        if (string.IsNullOrEmpty(profileType)) return null;

        if (profileType == "artist" && user?.ManagedArtist != null)
        {
            var artist = user.ManagedArtist;
            if (profileId.HasValue && artist.Id != profileId.Value) return null;

            return new ContentUploaderProfileDto
            {
                Type = "artist",
                ProfileId = artist.Id,
                Name = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileUrl = $"/artist/{artist.Id}"
            };
        }

        if (profileType == "serviceProvider" && user != null)
        {
            var provider = user.ServiceProviderProfiles
                .Where(p => !p.IsDeleted)
                .Where(p => !profileId.HasValue || p.Id == profileId.Value)
                .OrderByDescending(p => p.IsPrimaryProfile)
                .FirstOrDefault();

            if (provider != null)
            {
                var route = provider.IsTeacher ? "teacher" : "provider";
                return new ContentUploaderProfileDto
                {
                    Type = "serviceProvider",
                    ProfileId = provider.Id,
                    Name = provider.DisplayName,
                    ImageUrl = provider.ProfileImageUrl,
                    ProfileUrl = $"/{route}/{provider.Id}"
                };
            }
        }

        if (profileId.HasValue)
        {
            if (profileType == "artist")
            {
                var artist = _context.Artists
                    .AsNoTracking()
                    .FirstOrDefault(a => !a.IsDeleted && a.Id == profileId.Value);

                return artist == null
                    ? null
                    : new ContentUploaderProfileDto
                    {
                        Type = "artist",
                        ProfileId = artist.Id,
                        Name = artist.Name,
                        ImageUrl = artist.ImageUrl,
                        ProfileUrl = $"/artist/{artist.Id}"
                    };
            }

            if (profileType == "serviceProvider")
            {
                var provider = _context.ServiceProviders
                    .AsNoTracking()
                    .FirstOrDefault(p => !p.IsDeleted && p.Id == profileId.Value);

                if (provider == null) return null;

                var route = provider.IsTeacher ? "teacher" : "provider";
                return new ContentUploaderProfileDto
                {
                    Type = "serviceProvider",
                    ProfileId = provider.Id,
                    Name = provider.DisplayName,
                    ImageUrl = provider.ProfileImageUrl,
                    ProfileUrl = $"/{route}/{provider.Id}"
                };
            }
        }

        return null;
    }

    public async Task<SongDto?> GetRandomSongAsync()
    {
        try
        {
            var count = await _context.Songs
                .Where(s => !s.IsDeleted && s.IsApproved)
                .CountAsync();

            if (count == 0) return null;

            var randomId = await _context.Songs
                .Where(s => !s.IsDeleted && s.IsApproved)
                .OrderBy(s => s.Id)
                .Skip(Random.Shared.Next(count))
                .Select(s => s.Id)
                .FirstOrDefaultAsync();

            if (randomId == 0) return null;

            var song = await _context.Songs
                .Where(s => s.Id == randomId)
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
                .Include(s => s.OriginalKey)
                .Include(s => s.EasyKey)
                .Include(s => s.Composer)
                .Include(s => s.Lyricist)
                .Include(s => s.Arranger)
                .Include(s => s.SongGenres)
                    .ThenInclude(sg => sg.Genre)
                .Include(s => s.SongTags)
                    .ThenInclude(st => st.Tag)
                .FirstOrDefaultAsync();

            if (song == null)
            {
                return null;
            }

            return new SongDto
            {
                Id = song.Id,
                Title = song.Title,

                Artists = song.SongArtists
                    .OrderBy(sa => sa.Order)
                    .Select(sa => new ArtistBasicDto
                    {
                        Id = sa.Artist != null ? sa.Artist.Id : 0,
                        Name = sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown",
                        EnglishName = sa.Artist?.EnglishName,
                        ImageUrl = sa.Artist?.ImageUrl
                    })
                    .ToList(),

                LyricsWithChords = song.LyricsWithChords,
                OriginalKeyId = song.OriginalKeyId,
                OriginalKeyName = song.OriginalKey.Name,
                EasyKeyId = song.EasyKeyId,
                EasyKeyName = song.EasyKey?.Name,
                YoutubeUrl = song.YouTubeUrl,
                SpotifyUrl = song.SpotifyUrl,
                ImageUrl = song.ImageUrl,
                SheetMusicUrl = song.SheetMusicUrl,

                Composer = song.Composer != null ? new PersonBasicDto
                {
                    Id = song.Composer.Id,
                    Name = song.Composer.Name,
                    EnglishName = song.Composer.EnglishName
                } : null,

                Lyricist = song.Lyricist != null ? new PersonBasicDto
                {
                    Id = song.Lyricist.Id,
                    Name = song.Lyricist.Name,
                    EnglishName = song.Lyricist.EnglishName
                } : null,

                Arranger = song.Arranger != null ? new PersonBasicDto
                {
                    Id = song.Arranger.Id,
                    Name = song.Arranger.Name,
                    EnglishName = song.Arranger.EnglishName
                } : null,

                Genres = song.SongGenres
                    .Select(sg => new GenreDto
                    {
                        Id = sg.Genre.Id,
                        Name = sg.Genre.Name
                    })
                    .ToList(),

                Tags = song.SongTags
                    .Select(st => new TagDto
                    {
                        Id = st.Tag.Id,
                        Name = st.Tag.Name
                    })
                    .ToList(),

                IsApproved = song.IsApproved,
                ViewCount = song.ViewCount,
                PlayCount = song.PlayCount,
                Language = song.Language,
                DurationSeconds = song.DurationSeconds,
                CreatedAt = song.CreatedAt,
                UpdatedAt = song.UpdatedAt,
                BumpedAt = song.BumpedAt,
                UploadedByUserId = song.UploadedByUserId
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting random song: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> CanUserEditSongAsync(int songId, int userId)
    {
        try
        {
            var song = await _context.Songs
                .Where(s => s.Id == songId && !s.IsDeleted)
                .Select(s => new { s.UploadedByUserId })
                .FirstOrDefaultAsync();

            if (song == null)
            {
                return false;
            }

            var currentUser = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.Role })
                .FirstOrDefaultAsync();

            if (currentUser == null)
            {
                return false;
            }

            bool isAdmin = currentUser.Role == UserRole.Admin || currentUser.Role == UserRole.Manager;
            bool isUploader = song.UploadedByUserId == userId;

            return isAdmin || isUploader;
        }
        catch
        {
            return false;
        }
    }

    public async Task<PagedResult<SongBasicDto>> GetMySongsAsync(int userId, int pageNumber = 1, int pageSize = 8)
    {
        try
        {
            var artistIds = await _context.Artists
                .Where(a => a.UserId == userId && !a.IsDeleted)
                .Select(a => a.Id)
                .ToListAsync();

            var serviceProviderIds = await _context.ServiceProviders
                .Where(p => p.UserId == userId && !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync();

            var query = _context.Songs
                .Where(s => !s.IsDeleted &&
                    (s.UploadedByUserId == userId ||
                     s.UploaderUserId == userId ||
                     (s.UploaderProfileType == "artist" && s.UploaderProfileId.HasValue && artistIds.Contains(s.UploaderProfileId.Value)) ||
                     (s.UploaderProfileType == "serviceProvider" && s.UploaderProfileId.HasValue && serviceProviderIds.Contains(s.UploaderProfileId.Value))))
                .OrderByDescending(s => s.CreatedAt);

            var totalCount = await query.CountAsync();
            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new SongBasicDto
                {
                    Id = s.Id,
                    Title = s.Title,
                    ArtistNames = string.Join(", ", s.SongArtists
                        .OrderBy(sa => sa.Order)
                        .Select(sa => sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "")),
                    ImageUrl = s.ImageUrl,
                    IsApproved = s.IsApproved,
                    ViewCount = s.ViewCount,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return new PagedResult<SongBasicDto>
            {
                Items = items,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting user songs: {ex.Message}");
            throw;
        }
    }

    public async Task<List<SongDto>> GetApprovedSongsByUploaderProfileAsync(string profileType, int profileId, int limit = 12)
    {
        var songs = await _context.Songs
            .Where(s => !s.IsDeleted
                && s.IsApproved
                && s.UploaderProfileType == profileType
                && s.UploaderProfileId == profileId)
            .OrderByDescending(s => s.CreatedAt)
            .Take(limit)
            .Include(s => s.SongArtists)
                .ThenInclude(sa => sa.Artist)
            .Include(s => s.OriginalKey)
            .Include(s => s.EasyKey)
            .Include(s => s.Composer)
            .Include(s => s.Lyricist)
            .Include(s => s.Arranger)
            .Include(s => s.SongGenres)
                .ThenInclude(sg => sg.Genre)
            .Include(s => s.SongTags)
                .ThenInclude(st => st.Tag)
            .Include(s => s.UploaderUser)
                .ThenInclude(u => u!.ManagedArtist)
            .Include(s => s.UploaderUser)
                .ThenInclude(u => u!.ServiceProviderProfiles)
            .ToListAsync();

        return songs.Select(song => new SongDto
        {
            Id = song.Id,
            Title = song.Title,
            Artists = song.SongArtists
                .OrderBy(sa => sa.Order)
                .Select(sa => new ArtistBasicDto
                {
                    Id = sa.Artist != null ? sa.Artist.Id : 0,
                    Name = sa.Artist != null ? sa.Artist.Name : sa.TempArtistName ?? "Unknown",
                    EnglishName = sa.Artist?.EnglishName,
                    ImageUrl = sa.Artist?.ImageUrl
                })
                .ToList(),
            LyricsWithChords = song.LyricsWithChords,
            OriginalKeyId = song.OriginalKeyId,
            OriginalKeyName = song.OriginalKey.Name,
            EasyKeyId = song.EasyKeyId,
            EasyKeyName = song.EasyKey?.Name,
            YoutubeUrl = song.YouTubeUrl,
            SpotifyUrl = song.SpotifyUrl,
            ImageUrl = song.ImageUrl,
            SheetMusicUrl = song.SheetMusicUrl,
            Composer = song.Composer != null ? new PersonBasicDto
            {
                Id = song.Composer.Id,
                Name = song.Composer.Name,
                EnglishName = song.Composer.EnglishName
            } : null,
            Lyricist = song.Lyricist != null ? new PersonBasicDto
            {
                Id = song.Lyricist.Id,
                Name = song.Lyricist.Name,
                EnglishName = song.Lyricist.EnglishName
            } : null,
            Arranger = song.Arranger != null ? new PersonBasicDto
            {
                Id = song.Arranger.Id,
                Name = song.Arranger.Name,
                EnglishName = song.Arranger.EnglishName
            } : null,
            Genres = song.SongGenres
                .Select(sg => new GenreDto { Id = sg.Genre.Id, Name = sg.Genre.Name })
                .ToList(),
            Tags = song.SongTags
                .Select(st => new TagDto { Id = st.Tag.Id, Name = st.Tag.Name })
                .ToList(),
            IsApproved = song.IsApproved,
            ViewCount = song.ViewCount,
            PlayCount = song.PlayCount,
            Language = song.Language,
            DurationSeconds = song.DurationSeconds,
            CreatedAt = song.CreatedAt,
            UpdatedAt = song.UpdatedAt,
            BumpedAt = song.BumpedAt,
            UploadedByUserId = song.UploadedByUserId,
            UploaderUserId = song.UploaderUserId,
            UploaderProfileType = song.UploaderProfileType,
            UploaderProfileId = song.UploaderProfileId,
            UploaderProfile = ResolveUploaderProfile(song.UploaderUser, song.UploaderProfileType, song.UploaderProfileId)
        }).ToList();
    }

    // ============================================
    // MEDIUM PRIORITY - Search & Discovery
    // ============================================

    public async Task<DuplicateCheckResponseDto> CheckDuplicateAsync(string title)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(title) || title.Length < 3)
            {
                return new DuplicateCheckResponseDto
                {
                    IsPotentialDuplicate = false,
                    SimilarSongs = new List<SongBasicDto>()
                };
            }

            var normalizedTitle = NormalizeDuplicateTitle(title);
            var queryTokens = ExtractDuplicateTokens(normalizedTitle);
            var longestToken = queryTokens
                .OrderByDescending(token => token.Length)
                .FirstOrDefault();

            // Build the FreeText search term — use all tokens joined by spaces
            // FreeText uses Full-Text Index (no table scan), so it scales to any size
            var freeTextTerm = string.Join(" ", queryTokens.Any() ? queryTokens : new List<string> { title });

            var candidates = await _context.Songs
                .Where(s => !s.IsDeleted && s.IsApproved)
                .Where(s => EF.Functions.FreeText(s.Title, freeTextTerm))
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
                .Take(40)
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

            var similarSongs = candidates
                .Select(song => new
                {
                    Song = song,
                    Score = ScoreDuplicateTitle(normalizedTitle, NormalizeDuplicateTitle(song.Title))
                })
                .Where(item => item.Score >= 45)
                .OrderByDescending(item => item.Score)
                .ThenBy(item => item.Song.Title)
                .Take(5)
                .Select(item => item.Song)
                .ToList();

            return new DuplicateCheckResponseDto
            {
                IsPotentialDuplicate = similarSongs.Any(),
                SimilarSongs = similarSongs,
                Message = similarSongs.Any() ? "נמצאו שירים דומים במערכת" : ""
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error checking duplicates: {ex.Message}");
            return new DuplicateCheckResponseDto
            {
                IsPotentialDuplicate = false,
                SimilarSongs = new List<SongBasicDto>()
            };
        }
    }

    private static string NormalizeDuplicateTitle(string value)
    {
        var cleanedChars = value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) ? ch : ' ')
            .ToArray();

        return string.Join(" ", new string(cleanedChars)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static List<string> ExtractDuplicateTokens(string normalizedValue)
    {
        return normalizedValue
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => token.Length >= 2)
            .Distinct()
            .ToList();
    }

    private static int ScoreDuplicateTitle(string query, string candidate)
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

        var queryTokens = ExtractDuplicateTokens(query);
        var candidateTokens = ExtractDuplicateTokens(candidate);

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

    public async Task<List<AutocompleteResultDto>> AutocompleteAsync(string entityType, string query, int maxResults = 10)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            {
                return new List<AutocompleteResultDto>();
            }

            return entityType.ToLower() switch
            {
                "artists" => await AutocompleteArtistsAsync(query, maxResults),
                "genres" => await AutocompleteGenresAsync(query, maxResults),
                "people" => await AutocompletePeopleAsync(query, maxResults),
                "tags" => await AutocompleteTagsAsync(query, maxResults),
                _ => new List<AutocompleteResultDto>()
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in autocomplete for {entityType}: {ex.Message}");
            return new List<AutocompleteResultDto>();
        }
    }

    public async Task<List<SongBasicDto>> GetPopularSongsAsync(int limit = 10)
    {
        try
        {
            var songs = await _context.Songs
                .AsNoTracking()
                .Where(s => !s.IsDeleted && s.IsApproved)
                .OrderByDescending(s => s.ViewCount)
                .Take(limit)
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

            return songs;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting popular songs: {ex.Message}");
            return new List<SongBasicDto>();
        }
    }

    public async Task<bool> ToggleSongApprovalAsync(int id, bool isApproved)
    {
        try
        {
            var song = await _context.Songs
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (song == null)
            {
                throw new KeyNotFoundException("השיר לא נמצא");
            }

            song.IsApproved = isApproved;
            song.UpdatedAt = DateTime.UtcNow;

            var submission = await _context.ContentSubmissions
                .Where(cs => cs.SongId == song.Id && !cs.IsDeleted)
                .OrderByDescending(cs => cs.SubmittedAt)
                .FirstOrDefaultAsync();

            if (submission != null)
            {
                submission.Status = isApproved ? SubmissionStatus.Approved : SubmissionStatus.Pending;
                submission.ReviewedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            if (isApproved && song.UploadedByUserId.HasValue)
            {
                await _notificationService.NotifySongApprovedAsync(
                    song.UploadedByUserId.Value,
                    song.Id,
                    song.Title);
            }

            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error toggling song approval: {ex.Message}");
            throw;
        }
    }

    public async Task<SongDto> UpdateSongArtistsAsync(int id, UpdateSongArtistsDto dto)
    {
        var song = await _context.Songs
            .Include(s => s.SongArtists)
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

        if (song == null)
        {
            throw new KeyNotFoundException("Song not found");
        }

        var artistIds = await BuildSongArtistIdsForModeAsync(
            song.SongArtists.Where(sa => sa.ArtistId.HasValue).Select(sa => sa.ArtistId!.Value),
            dto.ArtistIds,
            dto.Mode);

        var normalizedMode = string.IsNullOrWhiteSpace(dto.Mode) ? "replace" : dto.Mode.Trim().ToLowerInvariant();
        var linksToRemove = normalizedMode == "replace"
            ? song.SongArtists.ToList()
            : song.SongArtists
                .Where(sa => sa.ArtistId.HasValue && !artistIds.Contains(sa.ArtistId.Value))
                .ToList();

        _context.SongArtists.RemoveRange(linksToRemove);

        var existingIds = normalizedMode == "replace"
            ? new HashSet<int>()
            : song.SongArtists
                .Where(sa => !linksToRemove.Contains(sa))
                .Where(sa => sa.ArtistId.HasValue)
                .Select(sa => sa.ArtistId!.Value)
                .ToHashSet();

        var artistIdsToAdd = artistIds
            .Where(artistId => !existingIds.Contains(artistId))
            .ToList();
        var nextOrder = normalizedMode == "replace"
            ? 1
            : song.SongArtists
                .Where(sa => !linksToRemove.Contains(sa))
                .Select(sa => sa.Order)
                .DefaultIfEmpty(0)
                .Max() + 1;

        foreach (var artistId in artistIdsToAdd)
        {
            _context.SongArtists.Add(new SongArtist
            {
                SongId = song.Id,
                ArtistId = artistId,
                Order = nextOrder++,
                IsTemporary = false
            });
        }

        song.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetSongByIdAsync(id, includeUnapproved: true))!;
    }

    public async Task<BulkSongActionResultDto> BulkUpdateSongArtistsAsync(BulkUpdateSongArtistsDto dto)
    {
        var songIds = dto.SongIds.Distinct().ToList();
        var changedSongs = new List<SongDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var songId in songIds)
        {
            changedSongs.Add(await UpdateSongArtistsAsync(songId, new UpdateSongArtistsDto
            {
                ArtistIds = dto.ArtistIds,
                Mode = dto.Mode
            }));
        }

        await transaction.CommitAsync();

        return new BulkSongActionResultDto
        {
            RequestedCount = songIds.Count,
            AffectedCount = changedSongs.Count,
            Songs = changedSongs
        };
    }

    public async Task<SongDto> UpdateSongUploaderAsync(int id, UpdateSongUploaderDto dto, int? callerUserId = null)
    {
        var song = await _context.Songs
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

        if (song == null)
        {
            throw new KeyNotFoundException("Song not found");
        }

        var uploader = await NormalizeUploaderAsync(
            callerUserId ?? dto.UploaderUserId ?? song.UploadedByUserId ?? 0,
            dto.UploaderUserId,
            dto.UploaderProfileType,
            dto.UploaderProfileId);

        song.UploaderUserId = uploader.UserId;
        song.UploaderProfileType = uploader.ProfileType;
        song.UploaderProfileId = uploader.ProfileId;
        song.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetSongByIdAsync(id, includeUnapproved: true))!;
    }

    public async Task<BulkSongActionResultDto> BulkUpdateSongUploaderAsync(BulkUpdateSongUploaderDto dto, int? callerUserId = null)
    {
        var songIds = dto.SongIds.Distinct().ToList();
        var changedSongs = new List<SongDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var songId in songIds)
        {
            changedSongs.Add(await UpdateSongUploaderAsync(songId, new UpdateSongUploaderDto
            {
                UploaderUserId = dto.UploaderUserId,
                UploaderProfileType = dto.UploaderProfileType,
                UploaderProfileId = dto.UploaderProfileId
            }, callerUserId));
        }

        await transaction.CommitAsync();

        return new BulkSongActionResultDto
        {
            RequestedCount = songIds.Count,
            AffectedCount = changedSongs.Count,
            Songs = changedSongs
        };
    }

    public async Task<SongDto> DuplicateSongAsync(int id)
    {
        var original = await _context.Songs
            .Include(s => s.SongArtists)
            .Include(s => s.SongGenres)
            .Include(s => s.SongTags)
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

        if (original == null)
            throw new InvalidOperationException("השיר לא נמצא");

        var newSong = new Song
        {
            Title = original.Title + " - עותק",
            LyricsWithChords = original.LyricsWithChords,
            OriginalKeyId = original.OriginalKeyId,
            EasyKeyId = original.EasyKeyId,
            YouTubeUrl = original.YouTubeUrl,
            SpotifyUrl = original.SpotifyUrl,
            ImageUrl = original.ImageUrl,
            SheetMusicUrl = original.SheetMusicUrl,
            ComposerId = original.ComposerId,
            LyricistId = original.LyricistId,
            ArrangerId = original.ArrangerId,
            Language = original.Language,
            DurationSeconds = original.DurationSeconds,
            IsApproved = false,
            UploadedByUserId = null,
            UploaderUserId = null,
            UploaderProfileType = null,
            UploaderProfileId = null,
            ViewCount = 0,
            PlayCount = 0,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.Songs.Add(newSong);
        await _chordIndexService.SyncSongChordsAsync(newSong.Id, newSong.LyricsWithChords);

        await _context.SaveChangesAsync();

        foreach (var sa in original.SongArtists)
        {
            _context.SongArtists.Add(new SongArtist
            {
                SongId = newSong.Id,
                ArtistId = sa.ArtistId,
                TempArtistName = sa.TempArtistName,
                Order = sa.Order,
                IsTemporary = sa.IsTemporary
            });
        }

        foreach (var sg in original.SongGenres)
        {
            _context.SongGenres.Add(new SongGenre { SongId = newSong.Id, GenreId = sg.GenreId });
        }

        foreach (var st in original.SongTags)
        {
            _context.SongTags.Add(new SongTag { SongId = newSong.Id, TagId = st.TagId });
        }

        await _context.SaveChangesAsync();

        return (await GetSongByIdAsync(newSong.Id, includeUnapproved: true))!;
    }

    public async Task<bool> DeleteSongAsync(int id)
    {
        var song = await _context.Songs
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

        if (song == null)
        {
            throw new KeyNotFoundException("השיר לא נמצא");
        }

        song.IsDeleted = true;
        song.UpdatedAt = DateTime.UtcNow;

        var submission = await _context.ContentSubmissions
            .Where(cs => cs.SongId == id && !cs.IsDeleted)
            .FirstOrDefaultAsync();

        if (submission != null)
        {
            submission.IsDeleted = true;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    // ============================================
    // LOW PRIORITY - Reference Data
    // ============================================

    public async Task<List<MusicalKeyDto>> GetMusicalKeysAsync()
    {
        try
        {
            if (_cache.TryGetValue("musical_keys", out List<MusicalKeyDto>? cached) && cached != null)
                return cached;

            var keys = await _context.MusicalKeys
                .AsNoTracking()
                .OrderBy(k => k.SemitoneOffset)
                .ThenBy(k => k.IsMinor)
                .Select(k => new MusicalKeyDto
                {
                    Id = k.Id,
                    Name = k.Name,
                    DisplayName = k.DisplayName,
                    IsMinor = k.IsMinor
                })
                .ToListAsync();

            _cache.Set("musical_keys", keys, TimeSpan.FromHours(24));
            return keys;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting musical keys: {ex.Message}");
            throw;
        }
    }

    public async Task<List<GenreDto>> GetAllGenresAsync()
    {
        try
        {
            var genres = await _context.Genres
                .OrderBy(g => g.Name)
                .Select(g => new GenreDto
                {
                    Id = g.Id,
                    Name = g.Name
                })
                .ToListAsync();

            return genres;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting genres: {ex.Message}");
            return new List<GenreDto>();
        }
    }

    // ============================================
    // ANALYTICS - Already Implemented
    // ============================================

    public async Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer)
    {
        var song = await _context.Songs.FindAsync(id);

        if (song == null)
        {
            throw new KeyNotFoundException("Song not found");
        }

        // Check daily view limit before recording (skip for this specific song if already viewed today)
        var todayStart = DateTime.UtcNow.Date;
        bool alreadyViewedToday = false;

        if (userId.HasValue)
        {
            alreadyViewedToday = await _context.SongViews
                .AnyAsync(sv => sv.SongId == id && sv.UserId == userId && sv.ViewedAt >= todayStart);
        }
        else if (!string.IsNullOrEmpty(ipAddress))
        {
            alreadyViewedToday = await _context.SongViews
                .AnyAsync(sv => sv.SongId == id && sv.IpAddress == ipAddress && sv.ViewedAt >= todayStart);
        }

        if (!alreadyViewedToday)
        {
            await CheckDailyLimitAsync(userId, ipAddress);
        }

        // Check if this is a unique view (within last 24 hours)
        var cutoffTime = DateTime.UtcNow.AddHours(-24);
        bool isUniqueView = false;

        if (userId.HasValue)
        {
            // For logged-in users: check by UserId
            isUniqueView = !await _context.SongViews
                .AnyAsync(sv => sv.SongId == id &&
                               sv.UserId == userId &&
                               sv.ViewedAt >= cutoffTime);
        }
        else if (!string.IsNullOrEmpty(ipAddress))
        {
            // For guest users: check by IP + UserAgent
            isUniqueView = !await _context.SongViews
                .AnyAsync(sv => sv.SongId == id &&
                               sv.IpAddress == ipAddress &&
                               sv.UserAgent == userAgent &&
                               sv.ViewedAt >= cutoffTime);
        }
        else
        {
            // No tracking info available, count as unique
            isUniqueView = true;
        }

        // Only increment if this is a unique view
        if (isUniqueView)
        {
            // Record the view
            var songView = new SongView
            {
                SongId = id,
                UserId = userId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Referrer = referrer,
                ViewedAt = DateTime.UtcNow
            };

            _context.SongViews.Add(songView);

            // Increment the counter
            song.ViewCount++;

            await _context.SaveChangesAsync();
        }

        return song.ViewCount;
    }

    public async Task<DailyLimitStatusDto> GetDailyLimitStatusAsync(int? userId, string? ipAddress)
    {
        var todayStart = DateTime.UtcNow.Date;

        int dailyViewCount;
        if (userId.HasValue)
        {
            dailyViewCount = await _context.SongViews
                .Where(sv => sv.UserId == userId && sv.ViewedAt >= todayStart)
                .Select(sv => sv.SongId)
                .Distinct()
                .CountAsync();
        }
        else if (!string.IsNullOrEmpty(ipAddress))
        {
            dailyViewCount = await _context.SongViews
                .Where(sv => sv.IpAddress == ipAddress && sv.ViewedAt >= todayStart)
                .Select(sv => sv.SongId)
                .Distinct()
                .CountAsync();
        }
        else
        {
            dailyViewCount = 0;
        }

        var (dailyLimit, tagHebrew) = await GetDailyLimitForUserAsync(userId);
        var remaining = Math.Max(0, dailyLimit - dailyViewCount);

        return new DailyLimitStatusDto
        {
            LimitExceeded = dailyViewCount >= dailyLimit,
            DailyViewCount = dailyViewCount,
            DailyLimit = dailyLimit,
            RemainingViews = remaining,
            TagHebrew = tagHebrew
        };
    }

    private async Task CheckDailyLimitAsync(int? userId, string? ipAddress)
    {
        var status = await GetDailyLimitStatusAsync(userId, ipAddress);

        if (status.LimitExceeded)
        {
            throw new DailyLimitExceededException(
                status.DailyViewCount,
                status.DailyLimit,
                status.TagHebrew);
        }
    }

    private async Task<(int limit, string? tagHebrew)> GetDailyLimitForUserAsync(int? userId)
    {
        // Admins and Managers — unlimited
        if (userId.HasValue)
        {
            var user = await _context.Users
                .Where(u => u.Id == userId.Value)
                .Select(u => new { u.Role, u.ContentTag })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                if (user.Role >= UserRole.Manager)
                    return (int.MaxValue, null);

                return user.ContentTag switch
                {
                    UserContentTag.LeadingContributor => (40, "תורם מוביל"),
                    UserContentTag.Contributor         => (20, "תורם"),
                    UserContentTag.Beginner            => (15, "מתחיל"),
                    _                                  => (10, null)
                };
            }
        }

        // Guest / unknown — base limit
        return (10, null);
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    private async Task<List<AutocompleteResultDto>> AutocompleteArtistsAsync(string query, int maxResults)
    {
        var normalizedQuery = query.Trim().ToLower();

        return await _context.Artists
            .AsNoTracking()
            .Where(a => !a.IsDeleted)
            .Where(a => a.Name.Contains(query) ||
                       (a.EnglishName != null && a.EnglishName.Contains(query)))
            .OrderBy(a => a.Name.ToLower() == normalizedQuery ? 0 :
                (a.EnglishName != null && a.EnglishName.ToLower() == normalizedQuery ? 1 :
                (a.Name.ToLower().StartsWith(normalizedQuery) ? 2 :
                (a.EnglishName != null && a.EnglishName.ToLower().StartsWith(normalizedQuery) ? 3 : 4))))
            .ThenBy(a => a.Name)
            .Take(maxResults)
            .Select(a => new AutocompleteResultDto
            {
                Id = a.Id,
                Value = a.Name,
                DisplayText = a.Name,
                SecondaryText = a.EnglishName,
                ImageUrl = a.ImageUrl,
                Type = "artist"
            })
            .ToListAsync();
    }

    private async Task<List<AutocompleteResultDto>> AutocompleteGenresAsync(string query, int maxResults)
    {
        return await _context.Genres
            .AsNoTracking()
            .Where(g => g.Name.Contains(query))
            .Take(maxResults)
            .Select(g => new AutocompleteResultDto
            {
                Id = g.Id,
                Value = g.Name,
                DisplayText = g.Name,
                Type = "genre"
            })
            .ToListAsync();
    }

    private async Task<List<AutocompleteResultDto>> AutocompletePeopleAsync(string query, int maxResults)
    {
        return await _context.People
            .AsNoTracking()
            .Where(p => !p.IsDeleted)
            .Where(p => p.Name.Contains(query) ||
                       (p.EnglishName != null && p.EnglishName.Contains(query)))
            .Take(maxResults)
            .Select(p => new AutocompleteResultDto
            {
                Id = p.Id,
                Value = p.Name,
                DisplayText = p.Name,
                SecondaryText = p.EnglishName,
                Type = "person"
            })
            .ToListAsync();
    }

    private async Task<List<AutocompleteResultDto>> AutocompleteTagsAsync(string query, int maxResults)
    {
        return await _context.Tags
            .AsNoTracking()
            .Where(t => t.Name.Contains(query))
            .Take(maxResults)
            .Select(t => new AutocompleteResultDto
            {
                Id = t.Id,
                Value = t.Name,
                DisplayText = t.Name,
                Type = "tag"
            })
            .ToListAsync();
    }

    /// <summary>
    /// Get or create a person (composer/lyricist/arranger)
    /// </summary>
    private async Task<int?> GetOrCreatePersonAsync(PersonInputDto? personDto, int userId)
    {
        if (personDto == null)
            return null;

        // If ID provided, use existing person
        if (personDto.Id.HasValue)
        {
            var exists = await _context.People.AnyAsync(p => p.Id == personDto.Id.Value && !p.IsDeleted);
            if (!exists)
                throw new Exception($"Person with ID {personDto.Id} not found");

            return personDto.Id.Value;
        }

        // Create new person
        var newPerson = new Person
        {
            Name = personDto.Name.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.People.Add(newPerson);
        await _context.SaveChangesAsync();

        // Create a report for admin review
        _context.ContentReports.Add(new ContentReport
        {
            UserId = userId,
            ContentType = "Person",
            ContentId = newPerson.Id,
            ReportType = "NewPerson",
            Description = $"נוסף אדם חדש למערכת: '{newPerson.Name}' (מלחין/משורר/מעבד)",
            ReportedAt = DateTime.UtcNow,
            Status = "Pending"
        });
        await _context.SaveChangesAsync();

        return newPerson.Id;
    }

    // ============================================
    // RATING — שמירה ושליפה של דירוגי שיר
    // ============================================

    public async Task<SongRatingResponseDto> RateSongAsync(int songId, int userId, int rating)
    {
        var existing = await _context.SongRatings
            .FirstOrDefaultAsync(r => r.SongId == songId && r.UserId == userId);

        if (existing != null)
        {
            existing.Rating = rating;
            existing.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.SongRatings.Add(new SongRating
            {
                SongId = songId,
                UserId = userId,
                Rating = rating,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        return await GetSongRatingAsync(songId, userId);
    }

    public async Task<SongRatingResponseDto> GetSongRatingAsync(int songId, int? userId)
    {
        var aggregate = await _context.SongRatings
            .Where(r => r.SongId == songId)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Average = g.Average(r => (double)r.Rating) })
            .FirstOrDefaultAsync();

        int? userRating = null;
        if (userId.HasValue)
            userRating = await _context.SongRatings
                .Where(r => r.SongId == songId && r.UserId == userId.Value)
                .Select(r => (int?)r.Rating)
                .FirstOrDefaultAsync();

        return new SongRatingResponseDto
        {
            AverageRating = aggregate != null ? Math.Round(aggregate.Average, 1) : 0,
            RatingCount = aggregate?.Count ?? 0,
            UserRating = userRating
        };
    }
}
