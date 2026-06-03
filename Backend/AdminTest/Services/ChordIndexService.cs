using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class ChordIndexService : IChordIndexService
{
    private static readonly Regex InlineChordRegex = new(@"\[(?<chord>[A-Ga-g](?:#|b)?[^\]\s]*)\]", RegexOptions.Compiled);
    private static readonly Regex ChordRegex = new(
        @"^(?<root>[A-Ga-g])(?<accidental>#|b)?(?<suffix>[^/]*)?(?:/(?<bass>[A-Ga-g])(?<bassAccidental>#|b)?)?$",
        RegexOptions.Compiled);

    private readonly AkordishKeitDbContext _context;

    public ChordIndexService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public IReadOnlyList<ChordIndexItem> ExtractChords(string? lyricsWithChords)
    {
        if (string.IsNullOrWhiteSpace(lyricsWithChords))
        {
            return Array.Empty<ChordIndexItem>();
        }

        var displayByNormalized = new Dictionary<string, string>(StringComparer.Ordinal);
        var lines = lyricsWithChords.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

        foreach (var line in lines)
        {
            foreach (Match match in InlineChordRegex.Matches(line))
            {
                AddChordTokens(ExpandChordToken(match.Groups["chord"].Value), displayByNormalized);
            }

            var tokens = line
                .Split(new[] { ' ', '\t', '|', ',' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(token => token.Trim('[', ']', '(', ')', '{', '}', ':', ';'))
                .Where(token => token.Length > 0)
                .SelectMany(ExpandChordToken)
                .ToList();

            if (tokens.Count == 0)
            {
                continue;
            }

            var chordTokens = tokens.Where(IsChordToken).ToList();
            if (chordTokens.Count > 0 && tokens.All(token => IsChordToken(token) || IsChordLineSeparator(token)))
            {
                foreach (var token in chordTokens)
                {
                    AddChord(token, displayByNormalized);
                }
            }
        }

        return displayByNormalized
            .OrderBy(item => item.Value)
            .Select(item => new ChordIndexItem(item.Value, item.Key))
            .ToList();
    }

    public string NormalizeChordName(string chordName)
    {
        var cleaned = chordName
            .Trim()
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

    public async Task SyncSongChordsAsync(int songId, string? lyricsWithChords)
    {
        var existing = await _context.SongChords
            .Where(chord => chord.SongId == songId)
            .ToListAsync();

        if (existing.Count > 0)
        {
            _context.SongChords.RemoveRange(existing);
        }

        var extracted = ExtractChords(lyricsWithChords);
        foreach (var chord in extracted)
        {
            _context.SongChords.Add(new SongChord
            {
                SongId = songId,
                DisplayChordName = chord.DisplayChordName,
                NormalizedChordName = chord.NormalizedChordName,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task EnsureApprovedSongsIndexedAsync(int batchSize = 250)
    {
        var songs = await _context.Songs
            .Where(song => song.IsApproved && !song.IsDeleted)
            .Where(song => !song.SongChords.Any())
            .OrderByDescending(song => song.CreatedAt)
            .Take(batchSize)
            .Select(song => new { song.Id, song.LyricsWithChords })
            .ToListAsync();

        if (songs.Count == 0)
        {
            return;
        }

        foreach (var song in songs)
        {
            await SyncSongChordsAsync(song.Id, song.LyricsWithChords);
        }

        await _context.SaveChangesAsync();
    }

    private static void AddChord(string chordName, IDictionary<string, string> displayByNormalized)
    {
        var trimmed = chordName.Trim();
        if (!IsChordToken(trimmed))
        {
            return;
        }

        var normalized = NormalizeStatic(trimmed);
        if (!string.IsNullOrWhiteSpace(normalized) && !displayByNormalized.ContainsKey(normalized))
        {
            displayByNormalized[normalized] = trimmed;
        }
    }

    private static void AddChordTokens(IEnumerable<string> tokens, IDictionary<string, string> displayByNormalized)
    {
        foreach (var token in tokens)
        {
            if (!IsChordLineSeparator(token))
            {
                AddChord(token, displayByNormalized);
            }
        }
    }

    private static IEnumerable<string> ExpandChordToken(string token)
    {
        var trimmed = token.Trim();
        if (trimmed.Length == 0)
        {
            return Array.Empty<string>();
        }

        if (IsChordToken(trimmed) || !trimmed.Contains('/'))
        {
            return new[] { trimmed };
        }

        var slashIndex = trimmed.IndexOf('/');
        if (slashIndex < 0 || trimmed.IndexOf('/', slashIndex + 1) >= 0)
        {
            return new[] { trimmed };
        }

        var left = trimmed[..slashIndex].Trim();
        var right = trimmed[(slashIndex + 1)..].Trim();
        if (!IsChordToken(left))
        {
            return new[] { trimmed };
        }

        var bassMatch = Regex.Match(right, @"^[A-Ga-g](?:#|b)?");
        if (!bassMatch.Success)
        {
            return new[] { trimmed };
        }

        var bass = bassMatch.Value;
        var gluedTail = right[bass.Length..];
        if (gluedTail.Length == 0)
        {
            return new[] { left + "/" + bass };
        }

        var tail = SplitGluedChordSequence(gluedTail);
        if (tail == null)
        {
            return new[] { trimmed };
        }

        return new[] { left + "/" + bass }.Concat(tail);
    }

    private static IReadOnlyList<string>? SplitGluedChordSequence(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return Array.Empty<string>();
        }

        return SplitGluedChordSequence(trimmed, 0, new Dictionary<int, IReadOnlyList<string>?>());
    }

    private static IReadOnlyList<string>? SplitGluedChordSequence(
        string value,
        int start,
        IDictionary<int, IReadOnlyList<string>?> memo)
    {
        if (start >= value.Length)
        {
            return Array.Empty<string>();
        }

        if (memo.TryGetValue(start, out var cached))
        {
            return cached;
        }

        for (var end = start + 1; end < value.Length; end++)
        {
            if (!IsChordStart(value[end]))
            {
                continue;
            }

            var candidate = value[start..end];
            if (!IsChordToken(candidate))
            {
                continue;
            }

            var rest = SplitGluedChordSequence(value, end, memo);
            if (rest == null)
            {
                continue;
            }

            memo[start] = new[] { candidate }.Concat(rest).ToList();
            return memo[start];
        }

        var remaining = value[start..];
        memo[start] = IsChordToken(remaining)
            ? new[] { remaining }
            : null;
        return memo[start];
    }

    private static bool IsChordStart(char value)
    {
        var upper = char.ToUpperInvariant(value);
        return upper is >= 'A' and <= 'G';
    }

    private static bool IsChordToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 24)
        {
            return false;
        }

        return ChordRegex.IsMatch(token.Trim());
    }

    private static bool IsChordLineSeparator(string token) =>
        token is "→" or "->" or "←" or "<-" or "/";

    private static string NormalizeStatic(string chordName)
    {
        var cleaned = chordName.Trim().Replace(" ", string.Empty);
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
        return note.ToUpperInvariant() + accidental;
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
