using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// DTO לרשימת השמעה (תצוגה בסיסית)
/// </summary>
public class PlaylistDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAdopted { get; set; }
    public int SongCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// DTO לרשימת השמעה עם כל השירים (תצוגה מפורטת)
/// </summary>
public class PlaylistDetailDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAdopted { get; set; }
    public List<PlaylistSongDto> Songs { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// DTO לשיר ברשימת השמעה
/// </summary>
public class PlaylistSongDto
{
    public int Id { get; set; }                    // PlaylistSong.Id
    public int SongId { get; set; }
    public string SongTitle { get; set; } = string.Empty;
    public string SongImageUrl { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public int Order { get; set; }
    public DateTime AddedAt { get; set; }
}

/// <summary>
/// DTO ליצירת רשימת השמעה חדשה
/// </summary>
public class CreatePlaylistDto
{
    [Required(ErrorMessage = "שם הרשימה הוא שדה חובה")]
    [MaxLength(100, ErrorMessage = "שם הרשימה חייב להיות עד 100 תווים")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "התיאור חייב להיות עד 500 תווים")]
    public string? Description { get; set; }

    public string? ImageUrl { get; set; }

    /// <summary>
    /// האם הרשימה ציבורית (ברירת מחדל: כן)
    /// </summary>
    public bool IsPublic { get; set; } = true;
}

/// <summary>
/// DTO לעדכון רשימת השמעה
/// </summary>
public class UpdatePlaylistDto
{
    [MaxLength(100, ErrorMessage = "שם הרשימה חייב להיות עד 100 תווים")]
    public string? Name { get; set; }

    [MaxLength(500, ErrorMessage = "התיאור חייב להיות עד 500 תווים")]
    public string? Description { get; set; }

    public string? ImageUrl { get; set; }

    public bool? IsPublic { get; set; }
}

/// <summary>
/// DTO להוספת שיר לרשימה
/// </summary>
public class AddSongToPlaylistDto
{
    [Required(ErrorMessage = "מזהה השיר הוא שדה חובה")]
    public int SongId { get; set; }
}

/// <summary>
/// DTO לשינוי סדר שירים ברשימה
/// </summary>
public class ReorderPlaylistDto
{
    [Required(ErrorMessage = "רשימת מזהי השירים הוא שדה חובה")]
    public List<int> SongIds { get; set; } = new();
}
