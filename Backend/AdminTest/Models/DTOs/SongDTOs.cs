using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

// ============================================
// REQUEST DTOs - מה שמגיע מ-Angular
// ============================================

/// <summary>
/// DTO להוספת שיר חדש - כל 3 השלבים ביחד!
/// </summary>
public class AddSongRequestDto
{
    // ===== שלב 1: פרטי בסיס =====

    [Required(ErrorMessage = "שם השיר הוא שדה חובה")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "שם השיר חייב להיות בין 2 ל-200 תווים")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "חייב להזין לפחות אמן אחד")]
    [MinLength(1, ErrorMessage = "חייב להזין לפחות אמן אחד")]
    [MaxLength(5, ErrorMessage = "ניתן להוסיף עד 5 אמנים בלבד")]
    public List<int> ArtistIds { get; set; } = new();

    [Required(ErrorMessage = "קישור YouTube הוא שדה חובה")]
    [Url(ErrorMessage = "כתובת YouTube לא תקינה")]
    [RegularExpression(@"^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$",
        ErrorMessage = "יש להזין קישור תקין של YouTube")]
    public string YoutubeUrl { get; set; } = string.Empty;

    [Url(ErrorMessage = "כתובת Spotify לא תקינה")]
    [RegularExpression(@"^(https?://)?(open\.spotify\.com)/.+$",
        ErrorMessage = "יש להזין קישור תקין של Spotify")]
    public string? SpotifyUrl { get; set; }

    public string? ImageUrl { get; set; }

    public List<int>? TagIds { get; set; }

    // ===== שלב 2: אקורדים וסולמות =====

    [Required(ErrorMessage = "מילים ואקורדים הם שדה חובה")]
    [MinLength(10, ErrorMessage = "נדרש להזין לפחות 10 תווים")]
    public string LyricsWithChords { get; set; } = string.Empty;

    [Required(ErrorMessage = "סולם מקורי הוא שדה חובה")]
    [Range(1, int.MaxValue, ErrorMessage = "יש לבחור סולם מקורי")]
    public int OriginalKeyId { get; set; }

    public int? EasyKeyId { get; set; }

    // ===== שלב 3: קרדיטים (אופציונלי) =====

    public int ComposerId { get; set; }
    public int? LyricistId { get; set; }
    public int? ArrangerId { get; set; }
    public List<int>? GenreIds { get; set; }
}
/// <summary>
/// DTO לעריכת שיר קיים
/// </summary>
public class UpdateSongRequestDto
{
    [Required(ErrorMessage = "שם השיר הוא שדה חובה")]
    [StringLength(200, MinimumLength = 2)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    [MaxLength(5)]
    public List<int> ArtistIds { get; set; } = new();

    [Required]
    [Url]
    public string YoutubeUrl { get; set; } = string.Empty;

    [Url]
    public string? SpotifyUrl { get; set; }

    public string? ImageUrl { get; set; }

    public List<int>? TagIds { get; set; }
    public List<int>? GenreIds { get; set; }

    [Required]
    [MinLength(10)]
    public string LyricsWithChords { get; set; } = string.Empty;

    [Required]
    public int OriginalKeyId { get; set; }

    public int? EasyKeyId { get; set; }

    public int ComposerId { get; set; }
    public int? LyricistId { get; set; }
    public int? ArrangerId { get; set; }
}
// ============================================
// RESPONSE DTOs - מה שחוזר ל-Angular
// ============================================

/// <summary>
/// תשובה אחרי הוספת שיר
/// </summary>
public class AddSongResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int? SongId { get; set; }
    public int? SubmissionId { get; set; }
    public bool IsApproved { get; set; }
}

/// <summary>
/// DTO לשיר מלא (כולל כל האמנים, תגיות, וכו')
/// </summary>
public class SongDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;

    // אמנים (עד 5)
    public List<ArtistBasicDto> Artists { get; set; } = new();

    public string LyricsWithChords { get; set; } = string.Empty;

    // סולמות
    public int OriginalKeyId { get; set; }
    public string OriginalKeyName { get; set; } = string.Empty;
    public int? EasyKeyId { get; set; }
    public string? EasyKeyName { get; set; }

    // קישורים
    public string YoutubeUrl { get; set; } = string.Empty;
    public string? SpotifyUrl { get; set; }
    public string? ImageUrl { get; set; }

    // קרדיטים
    public PersonBasicDto? Composer { get; set; }
    public PersonBasicDto? Lyricist { get; set; }
    public PersonBasicDto? Arranger { get; set; }

    // תגיות וז'אנרים
    public List<GenreDto> Genres { get; set; } = new();
    public List<TagDto> Tags { get; set; } = new();

    // מטא-דאטה
    public bool IsApproved { get; set; }
    public int ViewCount { get; set; }
    public int PlayCount { get; set; }
    public string? Language { get; set; }
    public int? DurationSeconds { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UploadedByUserId { get; set; }

}

/// <summary>
/// אמן בסיסי
/// </summary>
public class ArtistBasicDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }
    public string? ImageUrl { get; set; }
}

/// <summary>
/// אדם בסיסי (מלחין/מחבר/מעבד)
/// </summary>
public class PersonBasicDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }
}

/// <summary>
/// ז'אנר
/// </summary>
public class GenreDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// תגית
/// </summary>
public class TagDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// ============================================
// AUTOCOMPLETE & SEARCH DTOs
// ============================================

/// <summary>
/// תוצאת Autocomplete
/// </summary>
public class AutocompleteResultDto
{
    public int? Id { get; set; }
    public string Value { get; set; } = string.Empty;
    public string DisplayText { get; set; } = string.Empty;
    public string? SecondaryText { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = string.Empty; // "artist", "tag", "person"
}

/// <summary>
/// בדיקת כפילויות
/// </summary>
public class DuplicateCheckResponseDto
{
    public bool IsPotentialDuplicate { get; set; }
    public List<SongBasicDto> SimilarSongs { get; set; } = new();
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// שיר בסיסי (לבדיקת כפילויות)
/// </summary>
public class SongBasicDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ArtistNames { get; set; } = string.Empty; // "אמן 1, אמן 2"
    public string? ImageUrl { get; set; }
    public int ViewCount { get; set; }
}

// ============================================
// YOUTUBE METADATA DTOs
// ============================================

/// <summary>
/// מטא-דאטה מ-YouTube
/// </summary>
public class YouTubeMetadataDto
{
    public bool Success { get; set; }
    public string? Title { get; set; }
    public string? ChannelTitle { get; set; }
    public string? ThumbnailUrl { get; set; }
    public int? DurationSeconds { get; set; }
    public string? Description { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// DTO לסולם מוזיקלי
/// </summary>
public class MusicalKeyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // 'C', 'Am'
    public string DisplayName { get; set; } = string.Empty; // 'דו (C)'
    public bool IsMinor { get; set; }
}

/// <summary>
/// DTO לאישור/ביטול אישור שיר
/// </summary>
public class ToggleApprovalDto
{
    [Required(ErrorMessage = "יש לציין את סטטוס האישור")]
    public bool IsApproved { get; set; }
}