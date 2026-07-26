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
    public DbSet<UserInstrument> UserInstruments { get; set; }
    public DbSet<ContentSubmission> ContentSubmissions { get; set; }
    public DbSet<SongArtist> SongArtists { get; set; }
    // Social
    public DbSet<ArtistSocialLink> ArtistSocialLinks { get; set; }

    // Artist Media & Relationships
    public DbSet<ArtistGalleryImage> ArtistGalleryImages { get; set; }
    public DbSet<ArtistVideo> ArtistVideos { get; set; }
    public DbSet<ArtistHit> ArtistHits { get; set; }
    public DbSet<ArtistAlbum> ArtistAlbums { get; set; }
    public DbSet<ArticleArtist> ArticleArtists { get; set; }
    public DbSet<EventArtist> EventArtists { get; set; }
    public DbSet<PodcastEpisodeArtist> PodcastEpisodeArtists { get; set; }

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
    public DbSet<ArticleFeedback> ArticleFeedbacks { get; set; }

    // Events & Featured Content
    public DbSet<Event> Events { get; set; }
    public DbSet<FeaturedContent> FeaturedContents { get; set; }

    // Podcasts
    public DbSet<Podcast> Podcasts { get; set; }
    public DbSet<PodcastEpisode> PodcastEpisodes { get; set; }
    public DbSet<PodcastEpisodeView> PodcastEpisodeViews { get; set; }

    // News Page Dynamic Sections
    public DbSet<NewsPageSection> NewsPageSections { get; set; }
    public DbSet<NewsPageSectionCategory> NewsPageSectionCategories { get; set; }

    // Agencies
    public DbSet<Agency> Agencies { get; set; }
    public DbSet<AgencyProfile> AgencyProfiles { get; set; }
    public DbSet<AgencyContent> AgencyContents { get; set; }
    public DbSet<AgencyGalleryImage> AgencyGalleryImages { get; set; }
    public DbSet<AgencySocialLink> AgencySocialLinks { get; set; }

    // View Tracking
    public DbSet<SongView> SongViews { get; set; }
    public DbSet<EventView> EventViews { get; set; }

    // Button Click Tracking
    public DbSet<ButtonClick> ButtonClicks { get; set; }
    public DbSet<AdBlockCheck> AdBlockChecks { get; set; }

    // Playlists
    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<PlaylistSong> PlaylistSongs { get; set; }

    // Liked Content
    public DbSet<LikedContent> LikedContents { get; set; }
    public DbSet<UserKnownChord> UserKnownChords { get; set; }
    public DbSet<SongChord> SongChords { get; set; }

    // Content Reports
    public DbSet<ContentReport> ContentReports { get; set; }

    // Service Providers & Teachers (חדש!)
    public DbSet<MusicServiceProvider> ServiceProviders { get; set; }
    public DbSet<Teacher> Teachers { get; set; }
    public DbSet<TeacherTestimonial> TeacherTestimonials { get; set; }
    public DbSet<MusicServiceProviderTestimonial> ServiceProviderTestimonials { get; set; }
    public DbSet<MusicServiceProviderCategory> ServiceProviderCategories { get; set; }
    public DbSet<MusicServiceProviderCategoryMapping> ServiceProviderCategoryMappings { get; set; }
    public DbSet<TeacherInstrument> TeacherInstruments { get; set; }
    public DbSet<MusicServiceProviderGalleryImage> ServiceProviderGalleryImages { get; set; }
    public DbSet<MusicServiceProviderSocialLink> ServiceProviderSocialLinks { get; set; }
    public DbSet<MusicServiceProviderBranch> ServiceProviderBranches { get; set; }

    // Subscriptions (חדש!)
    public DbSet<Subscription> Subscriptions { get; set; }

    // Boosts (חדש!)
    public DbSet<Boost> Boosts { get; set; }

    // Bump Schedules
    public DbSet<BumpSchedule> BumpSchedules { get; set; }

    // Manual content/profile promotions
    public DbSet<ContentPromotion> ContentPromotions { get; set; }

    // Referral tracking
    public DbSet<UserReferralCode> UserReferralCodes { get; set; }
    public DbSet<UserReferral> UserReferrals { get; set; }

    // System Settings — Feature Flags
    public DbSet<SystemSetting> SystemSettings { get; set; }

    // Notifications
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<NotificationGroup> NotificationGroups { get; set; }
    public DbSet<NotificationGroupMember> NotificationGroupMembers { get; set; }

    // Email Campaigns
    public DbSet<EmailGroup> EmailGroups { get; set; }
    public DbSet<EmailGroupMember> EmailGroupMembers { get; set; }
    public DbSet<EmailSubscriber> EmailSubscribers { get; set; }
    public DbSet<SiteInterestRegistration> SiteInterestRegistrations { get; set; }
    public DbSet<MarketingUnsubscribe> MarketingUnsubscribes { get; set; }

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
        modelBuilder.ApplyConfiguration(new ArtistHitConfiguration());
        modelBuilder.ApplyConfiguration(new ArtistAlbumConfiguration());
        modelBuilder.ApplyConfiguration(new ArticleArtistConfiguration());
        modelBuilder.ApplyConfiguration(new EventArtistConfiguration());
        modelBuilder.ApplyConfiguration(new PodcastEpisodeArtistConfiguration());
        modelBuilder.ApplyConfiguration(new InstrumentConfiguration());
        modelBuilder.ApplyConfiguration(new UserInstrumentConfiguration());

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
        modelBuilder.ApplyConfiguration(new ArticleFeedbackConfiguration());

        // Events & Featured Content Configurations
        modelBuilder.ApplyConfiguration(new EventConfiguration());
        modelBuilder.ApplyConfiguration(new FeaturedContentConfiguration());

        // Podcast Configurations
        modelBuilder.ApplyConfiguration(new PodcastConfiguration());
        modelBuilder.ApplyConfiguration(new PodcastEpisodeConfiguration());
        modelBuilder.ApplyConfiguration(new PodcastEpisodeViewConfiguration());

        // View Tracking Configurations
        modelBuilder.ApplyConfiguration(new SongViewConfiguration());
        modelBuilder.ApplyConfiguration(new EventViewConfiguration());
        modelBuilder.ApplyConfiguration(new ButtonClickConfiguration());
        modelBuilder.ApplyConfiguration(new AdBlockCheckConfiguration());

        // Playlist Configurations
        modelBuilder.ApplyConfiguration(new PlaylistConfiguration());
        modelBuilder.ApplyConfiguration(new PlaylistSongConfiguration());

        // Liked Content Configuration
        modelBuilder.ApplyConfiguration(new LikedContentConfiguration());
        modelBuilder.ApplyConfiguration(new UserKnownChordConfiguration());
        modelBuilder.ApplyConfiguration(new SongChordConfiguration());

        // Content Reports Configuration
        modelBuilder.ApplyConfiguration(new ContentReportConfiguration());

        // Service Providers & Teachers Configurations (חדש!)
        modelBuilder.ApplyConfiguration(new MusicServiceProviderConfiguration());
        modelBuilder.ApplyConfiguration(new TeacherConfiguration());
        modelBuilder.ApplyConfiguration(new TeacherTestimonialConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderTestimonialConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderCategoryConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderCategoryMappingConfiguration());
        modelBuilder.ApplyConfiguration(new TeacherInstrumentConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderGalleryImageConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderSocialLinkConfiguration());
        modelBuilder.ApplyConfiguration(new MusicServiceProviderBranchConfiguration());

        // Subscription Configuration (חדש!)
        modelBuilder.ApplyConfiguration(new SubscriptionConfiguration());

        // Boost Configuration (חדש!)
        modelBuilder.ApplyConfiguration(new BoostConfiguration());

        // Bump Schedule Configuration
        modelBuilder.ApplyConfiguration(new BumpScheduleConfiguration());
        modelBuilder.ApplyConfiguration(new ContentPromotionConfiguration());
        modelBuilder.ApplyConfiguration(new UserReferralCodeConfiguration());
        modelBuilder.ApplyConfiguration(new UserReferralConfiguration());

        // News Page Sections Configuration
        modelBuilder.ApplyConfiguration(new NewsPageSectionConfiguration());
        modelBuilder.ApplyConfiguration(new NewsPageSectionCategoryConfiguration());

        // Agencies Configuration
        modelBuilder.ApplyConfiguration(new AgencyConfiguration());
        modelBuilder.ApplyConfiguration(new AgencyProfileConfiguration());
        modelBuilder.ApplyConfiguration(new AgencyContentConfiguration());
        modelBuilder.ApplyConfiguration(new AgencyGalleryImageConfiguration());
        modelBuilder.ApplyConfiguration(new AgencySocialLinkConfiguration());

        // System Settings Configuration
        modelBuilder.ApplyConfiguration(new SystemSettingConfiguration());

        // Notifications Configuration
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationGroupConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationGroupMemberConfiguration());

        // Email Campaign Groups
        modelBuilder.Entity<EmailGroup>(e =>
        {
            e.ToTable("EmailGroups");
            e.HasKey(g => g.Id);
            e.Property(g => g.Name).HasMaxLength(160).IsRequired();
            e.Property(g => g.Description).HasMaxLength(500);
            e.HasOne(g => g.CreatedByUser)
                .WithMany()
                .HasForeignKey(g => g.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<EmailGroupMember>(e =>
        {
            e.ToTable("EmailSubscriberGroups");
            e.HasKey(m => new { m.EmailGroupId, m.SubscriberId });
            e.HasOne(m => m.EmailGroup)
                .WithMany(g => g.Members)
                .HasForeignKey(m => m.EmailGroupId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.Subscriber)
                .WithMany(s => s.Groups)
                .HasForeignKey(m => m.SubscriberId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<EmailSubscriber>(e =>
        {
            e.ToTable("EmailSubscribers");
            e.HasKey(s => s.Id);
            e.Property(s => s.Email).HasMaxLength(320).IsRequired();
            e.Property(s => s.Name).HasMaxLength(200);
            e.Property(s => s.Source).HasMaxLength(100).IsRequired();
            e.HasIndex(s => s.Email).IsUnique();
            e.HasIndex(s => s.UserId).IsUnique().HasFilter("[UserId] IS NOT NULL");
            e.HasOne(s => s.User)
                .WithOne()
                .HasForeignKey<EmailSubscriber>(s => s.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<SiteInterestRegistration>(e =>
        {
            e.ToTable("SiteInterestRegistrations");
            e.HasKey(s => s.Id);
            e.Property(s => s.Email).HasMaxLength(320).IsRequired();
            e.Property(s => s.Source).HasMaxLength(100);
            e.HasIndex(s => s.Email).IsUnique();
        });
        modelBuilder.Entity<MarketingUnsubscribe>(e =>
        {
            e.ToTable("MarketingUnsubscribes");
            e.HasKey(u => u.Id);
            e.Property(u => u.Email).HasMaxLength(320).IsRequired();
            e.Property(u => u.Source).HasMaxLength(100).IsRequired();
            e.HasIndex(u => u.Email).IsUnique();
        });

        // Seed Data
        MusicalKeySeed.Seed(modelBuilder);
        GenreSeed.Seed(modelBuilder);
        TagSeed.Seed(modelBuilder);
        InstrumentSeed.Seed(modelBuilder);
    }
}
