using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Song
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? ComposerId { get; set; }
    public int? LyricistId { get; set; }
    public int? ArrangerId { get; set; }
    public string YouTubeUrl { get; set; } = string.Empty;
    public string? SpotifyUrl { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? SheetMusicUrl { get; set; }
    public bool IsApproved { get; set; }
    public string LyricsWithChords { get; set; } = string.Empty;
    public int OriginalKeyId { get; set; }
    public int? EasyKeyId { get; set; }
    public int? UploadedByUserId { get; set; }

    // תיוג מעלה תוכן — UserId של פרופיל ציבורי + סוג הפרופיל
    public int? UploaderUserId { get; set; }
    public string? UploaderProfileType { get; set; } // "artist" | "serviceProvider"
    public int? UploaderProfileId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? BumpedAt { get; set; }
    public int BumpCount { get; set; }
    public int ViewCount { get; set; }
    public int PlayCount { get; set; }
    public bool IsDeleted { get; set; }
    public string? Language { get; set; }
    public int? DurationSeconds { get; set; }


    // Navigation Properties
    public virtual Person? Composer { get; set; }
    public virtual Person? Lyricist { get; set; }
    public virtual Person? Arranger { get; set; }
    public virtual MusicalKey OriginalKey { get; set; } = null!;
    public virtual MusicalKey? EasyKey { get; set; }
    public virtual User? UploadedBy { get; set; }
    public virtual User? UploaderUser { get; set; }
    public virtual ICollection<SongArtist> SongArtists { get; set; } = new List<SongArtist>();
    public virtual ICollection<SongGenre> SongGenres { get; set; } = new List<SongGenre>();
    public virtual ICollection<SongTag> SongTags { get; set; } = new List<SongTag>();
    public virtual ICollection<SongRating> Ratings { get; set; } = new List<SongRating>();
    public virtual ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
    public virtual ICollection<SongChord> SongChords { get; set; } = new List<SongChord>();

}
