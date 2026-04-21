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

        var known = await _context.UserKnownChords
            .Where(kc => kc.UserId == userId && kc.Instrument == normalizedInstrument)
            .Select(kc => kc.NormalizedChordName)
            .ToListAsync();

        var knownSet = known.ToHashSet(StringComparer.Ordinal);
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);
        var safeMaxMissing = maxMissing < 0 ? int.MaxValue : Math.Clamp(maxMissing, 0, 99);
        var normalizedSort = string.IsNullOrWhiteSpace(sortBy)
            ? "closest"
            : sortBy.Trim().ToLowerInvariant();

        var chordRows = await _context.SongChords
            .Where(chord => chord.Song.IsApproved && !chord.Song.IsDeleted)
            .Select(chord => new
            {
                chord.SongId,
                chord.DisplayChordName,
                chord.NormalizedChordName
            })
            .ToListAsync();

        var stats = chordRows
            .GroupBy(chord => chord.SongId)
            .Select(group =>
            {
                var uniqueChords = group
                    .GroupBy(chord => chord.NormalizedChordName)
                    .Select(chordGroup => new
                    {
                        Normalized = chordGroup.Key,
                        Display = chordGroup.First().DisplayChordName
                    })
                    .ToList();

                var missing = uniqueChords
                    .Where(chord => !knownSet.Contains(chord.Normalized))
                    .Select(chord => chord.Display)
                    .OrderBy(chord => chord)
                    .ToList();

                return new
                {
                    SongId = group.Key,
                    TotalChordCount = uniqueChords.Count,
                    MissingChordNames = missing,
                    MissingChordCount = missing.Count,
                    KnownChordCount = uniqueChords.Count - missing.Count
                };
            })
            .Where(song => song.TotalChordCount > 0 && song.MissingChordCount <= safeMaxMissing)
            .ToList();

        var songIds = stats.Select(stat => stat.SongId).ToList();
        var songs = await _context.Songs
            .Where(song => songIds.Contains(song.Id))
            .Include(song => song.SongArtists)
                .ThenInclude(songArtist => songArtist.Artist)
            .ToListAsync();

        var songsById = songs.ToDictionary(song => song.Id);
        var allResults = stats
            .Where(stat => songsById.ContainsKey(stat.SongId))
            .Select(stat =>
            {
                var song = songsById[stat.SongId];
                return new KnownChordSongMatchDto
                {
                    Id = song.Id,
                    Title = song.Title,
                    ImageUrl = song.ImageUrl,
                    ViewCount = song.ViewCount,
                    TotalChordCount = stat.TotalChordCount,
                    KnownChordCount = stat.KnownChordCount,
                    MissingChordCount = stat.MissingChordCount,
                    MissingChordNames = stat.MissingChordNames,
                    KnowsAllChords = stat.MissingChordCount == 0,
                    Artists = song.SongArtists
                        .OrderBy(songArtist => songArtist.Order)
                        .Select(songArtist => new ArtistBasicDto
                        {
                            Id = songArtist.Artist?.Id ?? 0,
                            Name = songArtist.Artist?.Name ?? songArtist.TempArtistName ?? "Unknown",
                            EnglishName = songArtist.Artist?.EnglishName,
                            ImageUrl = songArtist.Artist?.ImageUrl
                    })
                        .ToList()
                };
            })
            .ToList();

        var sortedResults = normalizedSort switch
        {
            "known" => allResults
                .OrderByDescending(song => song.KnownChordCount)
                .ThenBy(song => song.MissingChordCount)
                .ThenBy(song => song.Title)
                .ToList(),
            "popular" => allResults
                .OrderByDescending(song => song.ViewCount)
                .ThenBy(song => song.MissingChordCount)
                .ThenBy(song => song.Title)
                .ToList(),
            "name" => allResults
                .OrderBy(song => song.Title)
                .ThenBy(song => song.MissingChordCount)
                .ToList(),
            _ => allResults
                .OrderBy(song => song.MissingChordCount)
                .ThenByDescending(song => song.KnownChordCount)
                .ThenBy(song => song.TotalChordCount)
                .ThenBy(song => song.Title)
                .ToList()
        };

        var totalCount = sortedResults.Count;
        var results = sortedResults
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
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
