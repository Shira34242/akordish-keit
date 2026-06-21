using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class ArtistSuggestionService : IArtistSuggestionService
{
    private readonly AkordishKeitDbContext _context;

    public ArtistSuggestionService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<List<ArtistSuggestionDto>> SuggestArtistsAsync(ArtistSuggestionRequestDto request)
    {
        var selectedIds = request.SelectedArtistIds.Distinct().ToHashSet();
        var fields = BuildFields(request);
        if (fields.Count == 0) return new List<ArtistSuggestionDto>();

        var artists = await _context.Artists
            .AsNoTracking()
            .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active && !selectedIds.Contains(a.Id))
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.EnglishName,
                a.ImageUrl
            })
            .ToListAsync();

        var suggestions = new List<ArtistSuggestionDto>();

        foreach (var artist in artists)
        {
            var names = new[] { artist.Name, artist.EnglishName }
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!.Trim())
                .Where(IsSafeSearchName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (names.Count == 0) continue;

            var matchedFields = new List<string>();
            var score = 0;

            foreach (var field in fields)
            {
                if (!names.Any(name => ContainsName(field.Value, name))) continue;

                matchedFields.Add(field.Label);
                score += field.Weight;
            }

            if (score == 0) continue;

            suggestions.Add(new ArtistSuggestionDto
            {
                ArtistId = artist.Id,
                ArtistName = artist.Name,
                ArtistImageUrl = artist.ImageUrl,
                Score = score,
                MatchedFields = matchedFields.Distinct().ToList()
            });
        }

        return suggestions
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.ArtistName)
            .Take(12)
            .ToList();
    }

    private static List<(string Label, string Value, int Weight)> BuildFields(ArtistSuggestionRequestDto request)
    {
        var fields = new List<(string Label, string Value, int Weight)>();
        AddField(fields, "כותרת", request.Title, 6);
        AddField(fields, "כותרת משנה", request.Subtitle, 4);
        AddField(fields, "שם אמן חופשי", request.ArtistName, 6);
        AddField(fields, "תיאור", request.Description, 3);
        AddField(fields, "תוכן", StripHtml(request.Content), 2);
        return fields;
    }

    private static void AddField(List<(string Label, string Value, int Weight)> fields, string label, string? value, int weight)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        var clean = Regex.Replace(value.Trim(), @"\s+", " ");
        if (clean.Length < 2) return;
        fields.Add((label, clean, weight));
    }

    private static bool IsSafeSearchName(string name)
    {
        if (name.Length < 3) return false;
        if (name.Count(char.IsLetterOrDigit) < 3) return false;
        return name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(part => part.Length >= 2);
    }

    private static bool ContainsName(string text, string name)
    {
        var pattern = $@"(?<![\p{{L}}\p{{N}}]){Regex.Escape(name)}(?![\p{{L}}\p{{N}}])";
        return Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static string? StripHtml(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? value
            : Regex.Replace(value, "<[^>]+>", " ");
    }
}
