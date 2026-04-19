using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class PlaylistDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAdopted { get; set; }
    public bool IsDefault { get; set; }
    public int SongCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class PlaylistDetailDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsPublic { get; set; }
    public bool IsAdopted { get; set; }
    public bool IsDefault { get; set; }
    public List<PlaylistSongDto> Songs { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class PlaylistSongDto
{
    public int Id { get; set; }
    public int SongId { get; set; }
    public string SongTitle { get; set; } = string.Empty;
    public string SongImageUrl { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public int Order { get; set; }
    public DateTime AddedAt { get; set; }
}

public class CreatePlaylistDto
{
    [Required(ErrorMessage = "שם הרשימה הוא שדה חובה")]
    [MaxLength(100, ErrorMessage = "שם הרשימה חייב להיות עד 100 תווים")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "התיאור חייב להיות עד 500 תווים")]
    public string? Description { get; set; }

    public string? ImageUrl { get; set; }

    public bool IsPublic { get; set; } = true;
}

public class UpdatePlaylistDto
{
    [MaxLength(100, ErrorMessage = "שם הרשימה חייב להיות עד 100 תווים")]
    public string? Name { get; set; }

    [MaxLength(500, ErrorMessage = "התיאור חייב להיות עד 500 תווים")]
    public string? Description { get; set; }

    public string? ImageUrl { get; set; }

    public bool? IsPublic { get; set; }
}

public class AddSongToPlaylistDto
{
    [Required(ErrorMessage = "מזהה השיר הוא שדה חובה")]
    public int SongId { get; set; }
}

public class ReorderPlaylistDto
{
    [Required(ErrorMessage = "רשימת מזהי השירים היא שדה חובה")]
    public List<int> SongIds { get; set; } = new();
}

public class SongPlaylistStateDto
{
    public bool IsInDefault { get; set; }
    public List<int> PlaylistIds { get; set; } = new();
}

public class RemoveFromDefaultPlaylistDto
{
    public bool RemoveFromPersonalPlaylists { get; set; }
}
