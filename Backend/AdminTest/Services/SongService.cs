using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class SongService : ISongService
{
    private readonly AkordishKeitDbContext _context;
    private readonly IYouTubeService _youTubeService;

    public SongService(AkordishKeitDbContext context, IYouTubeService youTubeService)
    {
        _context = context;
        _youTubeService = youTubeService;
    }

    // ============================================
    // HIGH PRIORITY - Core CRUD Operations
    // ============================================

    public async Task<AddSongResponseDto> CreateSongAsync(AddSongRequestDto dto, int userId)
    {
        // Use transaction to ensure atomicity
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Validate existing artists (only those with ID)
            var existingArtists = dto.Artists.Where(a => a.Id.HasValue).ToList();
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

            // 2. Fetch YouTube metadata if provided
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

            // 3. Create the song entity
            var song = new Song
            {
                Title = dto.Title.Trim(),
                LyricsWithChords = dto.LyricsWithChords,
                OriginalKeyId = dto.OriginalKeyId,
                EasyKeyId = dto.EasyKeyId,
                YouTubeUrl = dto.YoutubeUrl.Trim(),
                SpotifyUrl = dto.SpotifyUrl?.Trim(),
                ImageUrl = imageUrl ?? "default-song-image.jpg",
                ComposerId = dto.ComposerId,
                LyricistId = dto.LyricistId,
                ArrangerId = dto.ArrangerId,
                DurationSeconds = durationSeconds,
                UploadedByUserId = userId,
                IsApproved = false, // Not approved by default
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
                Status = SubmissionStatus.Pending,
                SubmittedByUserId = userId,
                SubmittedAt = DateTime.UtcNow
            };

            _context.ContentSubmissions.Add(submission);

            // Save all changes within transaction
            await _context.SaveChangesAsync();

            // Commit transaction
            await transaction.CommitAsync();

            return new AddSongResponseDto
            {
                Success = true,
                Message = "השיר הוגש בהצלחה! ממתין לאישור מנהל.",
                SongId = song.Id,
                SubmissionId = submission.Id,
                IsApproved = false
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

            // 3. Update basic fields
            song.Title = dto.Title.Trim();
            song.LyricsWithChords = dto.LyricsWithChords;
            song.OriginalKeyId = dto.OriginalKeyId;
            song.EasyKeyId = dto.EasyKeyId;
            song.YouTubeUrl = dto.YoutubeUrl.Trim();
            song.SpotifyUrl = dto.SpotifyUrl?.Trim();
            song.ImageUrl = dto.ImageUrl ?? song.ImageUrl;
            song.ComposerId = dto.ComposerId;
            song.LyricistId = dto.LyricistId;
            song.ArrangerId = dto.ArrangerId;
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
        string? sortBy = null,
        bool includeUnapproved = false)
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
                _ => query.OrderByDescending(s => s.CreatedAt)
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
                    UploadedByUserId = s.UploadedByUserId
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
                UploadedByUserId = song.UploadedByUserId
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting song by ID: {ex.Message}");
            throw;
        }
    }

    public async Task<SongDto?> GetRandomSongAsync()
    {
        try
        {
            var song = await _context.Songs
                .Where(s => !s.IsDeleted && s.IsApproved)
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
                .OrderBy(s => Guid.NewGuid()) // Random order
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

            var similarSongs = await _context.Songs
                .Where(s => !s.IsDeleted)
                .Where(s => EF.Functions.Like(s.Title, $"%{title}%"))
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
                .Take(5)
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
                .Where(s => !s.IsDeleted && s.IsApproved)
                .OrderByDescending(s => s.ViewCount)
                .Take(limit)
                .Include(s => s.SongArtists)
                    .ThenInclude(sa => sa.Artist)
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

            await _context.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error toggling song approval: {ex.Message}");
            throw;
        }
    }

    // ============================================
    // LOW PRIORITY - Reference Data
    // ============================================

    public async Task<List<MusicalKeyDto>> GetMusicalKeysAsync()
    {
        try
        {
            var keys = await _context.MusicalKeys
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

    // ============================================
    // Private Helper Methods
    // ============================================

    private async Task<List<AutocompleteResultDto>> AutocompleteArtistsAsync(string query, int maxResults)
    {
        return await _context.Artists
            .Where(a => !a.IsDeleted)
            .Where(a => a.Name.Contains(query) ||
                       (a.EnglishName != null && a.EnglishName.Contains(query)))
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
}
