using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class UserKnownChordService : IUserKnownChordService
{
    private static readonly HashSet<string> AllowedInstruments = new(StringComparer.OrdinalIgnoreCase)
    {
        "guitar",
        "piano",
        "ukulele"
    };

    private static readonly Regex ChordRegex = new(
        @"^(?<root>[A-Ga-g])(?<accidental>#|b|♯|♭)?(?<suffix>[^/]*)?(?:/(?<bass>[A-Ga-g])(?<bassAccidental>#|b|♯|♭)?)?$",
        RegexOptions.Compiled);

    private readonly AkordishKeitDbContext _context;
    private readonly IChordIndexService _chordIndexService;

    public UserKnownChordService(AkordishKeitDbContext context, IChordIndexService chordIndexService)
    {
        _context = context;
        _chordIndexService = chordIndexService;
    }

    public async Task<List<UserKnownChordDto>> GetUserKnownChordsAsync(int userId, string? instrument = null)
    {
        var query = _context.UserKnownChords
            .Where(kc => kc.UserId == userId);

        if (!string.IsNullOrWhiteSpace(instrument))
        {
            var normalizedInstrument = NormalizeInstrument(instrument);
            query = query.Where(kc => kc.Instrument == normalizedInstrument);
        }

        return await query
            .OrderBy(kc => kc.Instrument)
            .ThenBy(kc => kc.NormalizedChordName)
            .Select(kc => new UserKnownChordDto
            {
                Id = kc.Id,
                Instrument = kc.Instrument,
                ChordName = kc.ChordName,
                NormalizedChordName = kc.NormalizedChordName,
                AddedAt = kc.AddedAt
            })
            .ToListAsync();
    }

    public async Task<UserKnownChordDto?> AddKnownChordAsync(AddUserKnownChordDto dto, int userId)
    {
        var instrument = NormalizeInstrument(dto.Instrument);
        var normalizedChord = NormalizeChordName(dto.ChordName);
        if (!AllowedInstruments.Contains(instrument) || string.IsNullOrWhiteSpace(normalizedChord))
        {
            return null;
        }

        var existing = await _context.UserKnownChords
            .FirstOrDefaultAsync(kc =>
                kc.UserId == userId &&
                kc.Instrument == instrument &&
                kc.NormalizedChordName == normalizedChord);

        if (existing != null)
        {
            return Map(existing);
        }

        var knownChord = new UserKnownChord
        {
            UserId = userId,
            Instrument = instrument,
            ChordName = dto.ChordName.Trim(),
            NormalizedChordName = normalizedChord,
            AddedAt = DateTime.UtcNow
        };

        _context.UserKnownChords.Add(knownChord);
        await _context.SaveChangesAsync();

        return Map(knownChord);
    }

    public async Task<bool> RemoveKnownChordAsync(string instrument, string chordName, int userId)
    {
        var normalizedInstrument = NormalizeInstrument(instrument);
        var normalizedChord = NormalizeChordName(chordName);

        var knownChord = await _context.UserKnownChords
            .FirstOrDefaultAsync(kc =>
                kc.UserId == userId &&
                kc.Instrument == normalizedInstrument &&
                kc.NormalizedChordName == normalizedChord);

        if (knownChord == null)
        {
            return false;
        }

        _context.UserKnownChords.Remove(knownChord);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<KnownChordSongSummaryDto> BuildSummaryAsync(KnownChordSongSummaryRequestDto dto, int userId)
    {
        var instrument = NormalizeInstrument(dto.Instrument);
        var displayByNormalized = dto.Chords
            .Where(chord => !string.IsNullOrWhiteSpace(chord))
            .Select(chord => new { Original = chord.Trim(), Normalized = NormalizeChordName(chord) })
            .Where(chord => !string.IsNullOrWhiteSpace(chord.Normalized))
            .GroupBy(chord => chord.Normalized)
            .ToDictionary(group => group.Key, group => group.First().Original);

        var normalizedChords = displayByNormalized.Keys.ToList();

        var known = await _context.UserKnownChords
            .Where(kc => kc.UserId == userId && kc.Instrument == instrument)
            .Where(kc => normalizedChords.Contains(kc.NormalizedChordName))
            .Select(kc => kc.NormalizedChordName)
            .ToListAsync();

        var knownSet = known.ToHashSet(StringComparer.Ordinal);
        var missing = normalizedChords
            .Where(chord => !knownSet.Contains(chord))
            .Select(chord => displayByNormalized[chord])
            .OrderBy(chord => chord)
            .ToList();

        return new KnownChordSongSummaryDto
        {
            TotalChords = normalizedChords.Count,
            KnownChords = normalizedChords.Count - missing.Count,
            MissingChords = missing.Count,
            MissingChordNames = missing,
            KnowsAll = normalizedChords.Count > 0 && missing.Count == 0
        };
    }

    public async Task<PagedResult<KnownChordSongMatchDto>> GetMatchingSongsAsync(
        int userId,
        string instrument,
        int maxMissing,
        string? sortBy,
        int page,
        int pageSize)
    {
        var normalizedInstrument = NormalizeInstrument(instrument);
        if (!AllowedInstruments.Contains(normalizedInstrument))
        {
            return new PagedResult<KnownChordSongMatchDto>
            {
                PageNumber = Math.Max(1, page),
                PageSize = Math.Clamp(pageSize, 1, 50)
            };
        }

        await _chordIndexService.EnsureApprovedSongsIndexedAsync();

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);
        var safeMaxMissing = maxMissing < 0 ? int.MaxValue : Math.Clamp(maxMissing, 0, 99);
        var normalizedSort = string.IsNullOrWhiteSpace(sortBy)
            ? "closest"
            : sortBy.Trim().ToLowerInvariant();

        // Load user's known chords (small, indexed query)
        var knownChords = await _context.UserKnownChords
            .Where(kc => kc.UserId == userId && kc.Instrument == normalizedInstrument)
            .Select(kc => kc.NormalizedChordName)
            .ToListAsync();

        var baseChords = _context.SongChords
            .Where(sc => sc.Song.IsApproved && !sc.Song.IsDeleted);

        // Aggregate in DB: distinct chord count per song
        var totalPerSong = await baseChords
            .GroupBy(sc => sc.SongId)
            .Select(g => new { SongId = g.Key, Total = g.GroupBy(sc => sc.NormalizedChordName).Count() })
            .ToListAsync();

        // Aggregate in DB: distinct missing chord count per song (not in user's known set)
        var missingPerSong = await baseChords
            .Where(sc => !knownChords.Contains(sc.NormalizedChordName))
            .GroupBy(sc => sc.SongId)
            .Select(g => new { SongId = g.Key, Missing = g.GroupBy(sc => sc.NormalizedChordName).Count() })
            .ToListAsync();

        var missingBySong = missingPerSong.ToDictionary(x => x.SongId, x => x.Missing);

        // Combine and filter in memory (now working with small count dictionaries, not raw chord rows)
        var stats = totalPerSong
            .Where(x => x.Total > 0)
            .Select(x => new
            {
                x.SongId,
                TotalChordCount = x.Total,
                MissingChordCount = missingBySong.GetValueOrDefault(x.SongId, 0)
            })
            .Where(x => x.MissingChordCount <= safeMaxMissing)
            .ToList();

        if (stats.Count == 0)
        {
            return new PagedResult<KnownChordSongMatchDto>
            {
                Items = new List<KnownChordSongMatchDto>(),
                TotalCount = 0,
                PageNumber = safePage,
                PageSize = safePageSize
            };
        }

        var allMatchingSongIds = stats.Select(x => x.SongId).ToList();

        // For sorts that need extra song columns, fetch only those columns
        Dictionary<int, int> viewCountById = new();
        Dictionary<int, string> titleById = new();

        if (normalizedSort == "popular")
        {
            viewCountById = await _context.Songs
                .Where(s => allMatchingSongIds.Contains(s.Id))
                .Select(s => new { s.Id, s.ViewCount })
                .ToDictionaryAsync(s => s.Id, s => s.ViewCount);
        }
        else if (normalizedSort == "name")
        {
            titleById = await _context.Songs
                .Where(s => allMatchingSongIds.Contains(s.Id))
                .Select(s => new { s.Id, s.Title })
                .ToDictionaryAsync(s => s.Id, s => s.Title);
        }

        var sortedStats = normalizedSort switch
        {
            "known" => stats
                .OrderByDescending(x => x.TotalChordCount - x.MissingChordCount)
                .ThenBy(x => x.MissingChordCount)
                .ThenBy(x => x.SongId)
                .ToList(),
            "popular" => stats
                .OrderByDescending(x => viewCountById.GetValueOrDefault(x.SongId, 0))
                .ThenBy(x => x.MissingChordCount)
                .ThenBy(x => x.SongId)
                .ToList(),
            "name" => stats
                .OrderBy(x => titleById.GetValueOrDefault(x.SongId, ""))
                .ThenBy(x => x.MissingChordCount)
                .ThenBy(x => x.SongId)
                .ToList(),
            _ => stats
                .OrderBy(x => x.MissingChordCount)
                .ThenByDescending(x => x.TotalChordCount - x.MissingChordCount)
                .ThenBy(x => x.TotalChordCount)
                .ThenBy(x => x.SongId)
                .ToList()
        };

        var totalCount = sortedStats.Count;
        var pageStats = sortedStats
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        var pageSongIds = pageStats.Select(x => x.SongId).ToList();

        // Load song details + artists for current page only
        var songs = await _context.Songs
            .Where(s => pageSongIds.Contains(s.Id))
            .Include(s => s.SongArtists)
                .ThenInclude(sa => sa.Artist)
            .ToListAsync();

        // Load missing chord display names for current page songs only
        var pageMissingChordRows = await _context.SongChords
            .Where(sc => pageSongIds.Contains(sc.SongId) && !knownChords.Contains(sc.NormalizedChordName))
            .Select(sc => new { sc.SongId, sc.DisplayChordName, sc.NormalizedChordName })
            .ToListAsync();

        var missingChordNamesBySong = pageMissingChordRows
            .GroupBy(x => x.SongId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(x => x.NormalizedChordName)
                      .Select(ng => ng.First().DisplayChordName)
                      .OrderBy(name => name)
                      .ToList()
            );

        var songsById = songs.ToDictionary(s => s.Id);

        var results = pageStats
            .Where(x => songsById.ContainsKey(x.SongId))
            .Select(x =>
            {
                var song = songsById[x.SongId];
                return new KnownChordSongMatchDto
                {
                    Id = song.Id,
                    Title = song.Title,
                    ImageUrl = song.ImageUrl,
                    ViewCount = song.ViewCount,
                    TotalChordCount = x.TotalChordCount,
                    KnownChordCount = x.TotalChordCount - x.MissingChordCount,
                    MissingChordCount = x.MissingChordCount,
                    MissingChordNames = missingChordNamesBySong.GetValueOrDefault(x.SongId, new List<string>()),
                    KnowsAllChords = x.MissingChordCount == 0,
                    Artists = song.SongArtists
                        .OrderBy(sa => sa.Order)
                        .Select(sa => new ArtistBasicDto
                        {
                            Id = sa.Artist?.Id ?? 0,
                            Name = sa.Artist?.Name ?? sa.TempArtistName ?? "Unknown",
                            EnglishName = sa.Artist?.EnglishName,
                            ImageUrl = sa.Artist?.ImageUrl
                        })
                        .ToList()
                };
            })
            .ToList();

        return new PagedResult<KnownChordSongMatchDto>
        {
            Items = results,
            TotalCount = totalCount,
            PageNumber = safePage,
            PageSize = safePageSize
        };
    }

    private static string NormalizeInstrument(string instrument)
    {
        return instrument.Trim().ToLowerInvariant();
    }

    private static UserKnownChordDto Map(UserKnownChord knownChord)
    {
        return new UserKnownChordDto
        {
            Id = knownChord.Id,
            Instrument = knownChord.Instrument,
            ChordName = knownChord.ChordName,
            NormalizedChordName = knownChord.NormalizedChordName,
            AddedAt = knownChord.AddedAt
        };
    }

    private static string NormalizeChordName(string chordName)
    {
        var cleaned = chordName
            .Trim()
            .Replace("♯", "#")
            .Replace("♭", "b")
            .Replace("∆", "maj")
            .Replace("Δ", "maj")
            .Replace("−", "m")
            .Replace(" ", string.Empty);

        if (cleaned.StartsWith("[") && cleaned.EndsWith("]") && cleaned.Length > 2)
        {
            cleaned = cleaned[1..^1];
        }

        var match = ChordRegex.Match(cleaned);
        if (!match.Success)
        {
            return cleaned;
        }

        var root = NormalizeNote(match.Groups["root"].Value, match.Groups["accidental"].Value);
        var suffix = NormalizeSuffix(match.Groups["suffix"].Value);
        var bass = match.Groups["bass"].Success
            ? "/" + NormalizeNote(match.Groups["bass"].Value, match.Groups["bassAccidental"].Value)
            : string.Empty;

        return root + suffix + bass;
    }

    private static string NormalizeNote(string note, string accidental)
    {
        return note.ToUpperInvariant() + accidental.Replace("♯", "#").Replace("♭", "b");
    }

    private static string NormalizeSuffix(string suffix)
    {
        if (string.IsNullOrWhiteSpace(suffix))
        {
            return string.Empty;
        }

        var normalized = suffix.Trim();
        normalized = Regex.Replace(normalized, "^minor", "m", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, "^major", "maj", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, "^min", "m", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, "^maj", "maj", RegexOptions.IgnoreCase);
        return normalized;
    }
}
