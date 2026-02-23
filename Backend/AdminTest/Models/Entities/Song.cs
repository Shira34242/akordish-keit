using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Song
{
    public int Id { get; set; }
    public string Title { get; set; }
    public int? ComposerId { get; set; }
    public int? LyricistId { get; set; }
    public int? ArrangerId { get; set; }
    public string YouTubeUrl { get; set; }
    public string? SpotifyUrl { get; set; }
    public string ImageUrl { get; set; }
    public bool IsApproved { get; set; }
    public string LyricsWithChords { get; set; }
    public int OriginalKeyId { get; set; }
    public int? EasyKeyId { get; set; }
    public int? UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int ViewCount { get; set; }
    public int PlayCount { get; set; }
    public bool IsDeleted { get; set; }
    public string? Language { get; set; }
    public int? DurationSeconds { get; set; }


    // Navigation Properties
    public virtual Person? Composer { get; set; }
    public virtual Person? Lyricist { get; set; }
    public virtual Person? Arranger { get; set; }
    public virtual MusicalKey OriginalKey { get; set; }
    public virtual MusicalKey? EasyKey { get; set; }
    public virtual User? UploadedBy { get; set; }
    public virtual ICollection<SongArtist> SongArtists { get; set; }
    public virtual ICollection<SongGenre> SongGenres { get; set; }
    public virtual ICollection<SongTag> SongTags { get; set; }
    public virtual ICollection<SongRating> Ratings { get; set; }
    public virtual ICollection<Favorite> Favorites { get; set; }

}