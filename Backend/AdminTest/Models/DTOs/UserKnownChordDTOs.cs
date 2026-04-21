using System;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class UserKnownChordDto
{
    public int Id { get; set; }
    public string Instrument { get; set; } = string.Empty;
    public string ChordName { get; set; } = string.Empty;
    public string NormalizedChordName { get; set; } = string.Empty;
    public DateTime AddedAt { get; set; }
}

public class AddUserKnownChordDto
{
    [Required]
    [StringLength(20)]
    public string Instrument { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string ChordName { get; set; } = string.Empty;
}

public class KnownChordSongSummaryRequestDto
{
    [Required]
    [StringLength(20)]
    public string Instrument { get; set; } = string.Empty;

    public List<string> Chords { get; set; } = new();
}

public class KnownChordSongSummaryDto
{
    public int TotalChords { get; set; }
    public int KnownChords { get; set; }
    public int MissingChords { get; set; }
    public List<string> MissingChordNames { get; set; } = new();
    public bool KnowsAll { get; set; }
}

public class KnownChordSongMatchDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public List<ArtistBasicDto> Artists { get; set; } = new();
    public string? ImageUrl { get; set; }
    public int ViewCount { get; set; }
    public int TotalChordCount { get; set; }
    public int KnownChordCount { get; set; }
    public int MissingChordCount { get; set; }
    public List<string> MissingChordNames { get; set; } = new();
    public bool KnowsAllChords { get; set; }
}
