using AkordishKeit.Data.Configurations;
using AkordishKeit.Data.Seed;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data;

public class AkordishKeitDbContext : DbContext
{
    public AkordishKeitDbContext(DbContextOptions<AkordishKeitDbContext> options)
        : base(options)
    {
    }

    // Core DbSets
    public DbSet<User> Users { get; set; }
    public DbSet<Song> Songs { get; set; }
    public DbSet<Artist> Artists { get; set; }

    // People
    public DbSet<Person> People { get; set; }

    // Music
    public DbSet<MusicalKey> MusicalKeys { get; set; }
    public DbSet<Genre> Genres { get; set; }
    public DbSet<Tag> Tags { get; set; }

    // Relationships
    public DbSet<SongGenre> SongGenres { get; set; }
    public DbSet<SongTag> SongTags { get; set; }
    public DbSet<Favorite> Favorites { get; set; }
    public DbSet<SongRating> SongRatings { get; set; }
    public DbSet<Instrument> Instruments { get; set; }
    public DbSet<ContentSubmission> ContentSubmissions { get; set; }
    public DbSet<SongArtist> SongArtists { get; set; }
    // Social
    public DbSet<ArtistSocialLink> ArtistSocialLinks { get; set; }

    // Artist Media & Relationships
    public DbSet<ArtistGalleryImage> ArtistGalleryImages { get; set; }
    public DbSet<ArtistVideo> ArtistVideos { get; set; }
    public DbSet<ArticleArtist> ArticleArtists { get; set; }
    public DbSet<EventArtist> EventArtists { get; set; }

    // Advertisements
    public DbSet<Client> Clients { get; set; }
    public DbSet<AdSpot> AdSpots { get; set; }
    public DbSet<AdCampaign> AdCampaigns { get; set; }
    public DbSet<AdCampaignView> AdCampaignViews { get; set; }
    public DbSet<AdCampaignClick> AdCampaignClicks { get; set; }

    // Articles & News
    public DbSet<Article> Articles { get; set; }
    public DbSet<ArticleCategoryEntity> ArticleCategories { get; set; }
    public DbSet<ArticleArticleCategory> ArticleArticleCategories { get; set; }
    public DbSet<ArticleTag> ArticleTags { get; set; }
    public DbSet<ArticleGalleryImage> ArticleGalleryImages { get; set; }
    public DbSet<ArticleView> ArticleViews { get; set; }

    // Events & Featured Content
    public DbSet<Event> Events { get; set; }
    public DbSet<FeaturedContent> FeaturedContents { get; set; }

    // View Tracking
    public DbSet<SongView> SongViews { get; set; }

    // Playlists
    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<PlaylistSong> PlaylistSongs { get; set; }

    // Liked Content
    public DbSet<LikedContent> LikedContents { get; set; }

    // Content Reports
    public DbSet<ContentReport> ContentReports { get; set; }

    // Service Providers & Teachers (חדש!)
    public DbSet<MusicServiceProvider> ServiceProviders { get; set; }
    public DbSet<Teacher> Teachers { get; set; }
    public DbSet<MusicServiceProviderCategory> ServiceProviderCategories { get; set; }
    public DbSet<MusicServiceProviderCategoryMapping> ServiceProviderCategoryMappings { get; set; }
    public DbSet<TeacherInstrument> TeacherInstruments { get; set; }
    public DbSet<MusicServiceProviderGalleryImage> ServiceProviderGalleryImages { get; set; }

    // Subscriptions (חדש!)
    public DbSet<Subscription> Subscriptions { get; set; }

    // Boosts (חדש!)
    public DbSet<Boost> Boosts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply All Configurations
        modelBuilder.ApplyConfiguration(new SongArtistConfiguration());
        modelBuilder.ApplyConfiguration(new ContentSubmissionConfiguration());
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new SongConfiguration());
        modelBuilder.ApplyConfiguration(new ArtistConfiguration());
        modelBuilder.ApplyConfiguration(new PersonConfiguration());
        modelBuilder.ApplyConfiguration(new MusicalKeyConfiguration());
        modelBuilder.ApplyConfiguration(new GenreConfiguration());
        modelBuilder.ApplyConfiguration(new TagConfiguration());
        modelBuilder.ApplyConfiguration(new FavoriteConfiguration());
        modelBuilder.ApplyConfiguration(new SongRatingConfiguration());
        modelBuilder.ApplyConfiguration(new SongGenreConfiguration());
        modelBuilder.ApplyConfiguration(new SongTagConfiguration());
        modelBuilder.ApplyConfiguration(new ArtistSocialLinkConfiguration());
        modelBuilder.ApplyConfiguration(new ArtistGalleryImageConfiguration());
        modelBuilder.ApplyConfiguration(new ArtistVideoConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleArtistConfiguration());
        modelBuilder.ApplyConfiguration(new EventArtistConfiguration());
        modelBuilder.ApplyConfiguration(new InstrumentConfiguration());

        // Advertisement Configurations
        modelBuilder.ApplyConfiguration(new ClientConfiguration());
        modelBuilder.ApplyConfiguration(new AdSpotConfiguration());
        modelBuilder.ApplyConfiguration(new AdCampaignConfiguration());
        modelBuilder.ApplyConfiguration(new AdCampaignViewConfiguration());
        modelBuilder.ApplyConfiguration(new AdCampaignClickConfiguration());

        // Article Configurations
        modelBuilder.ApplyConfiguration(new ArticleConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleCategoryEntityConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleArticleCategoryConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleTagConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleGalleryImageConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleViewConfiguration());

        // Events & Featured Content Configurations
        modelBuilder.ApplyConfiguration(new EventConfiguration());
        modelBuilder.ApplyConfiguration(new FeaturedContentConfiguration());

        // View Tracking Configurations
        modelBuilder.ApplyConfiguration(new SongViewConfiguration());

        // Playlist Configurations
        modelBuilder.ApplyConfiguration(new PlaylistConfiguration());
        modelBuilder.ApplyConfiguration(new PlaylistSongConfiguration());

        // Liked Content Configuration
        modelBuilder.ApplyConfiguration(new LikedContentConfiguration());

        // Content Reports Configuration
        modelBuilder.ApplyConfiguration(new ContentReportConfiguration());

        // Service Providers & Teachers Configurations (חדש!)
        modelBuilder.ApplyConfiguration(new MusicServiceProviderConfiguration());
        modelBuilder.ApplyConfiguration(new TeacherConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderCategoryConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderCategoryMappingConfiguration());
        modelBuilder.ApplyConfiguration(new TeacherInstrumentConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderGalleryImageConfiguration());

        // Subscription Configuration (חדש!)
        modelBuilder.ApplyConfiguration(new SubscriptionConfiguration());

        // Boost Configuration (חדש!)
        modelBuilder.ApplyConfiguration(new BoostConfiguration());

        // Seed Data
        MusicalKeySeed.Seed(modelBuilder);
        GenreSeed.Seed(modelBuilder);
        TagSeed.Seed(modelBuilder);
        InstrumentSeed.Seed(modelBuilder);
        ArticleCategorySeed.Seed(modelBuilder);

    }
}