using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistConfiguration : IEntityTypeConfiguration<Artist>
{
    public void Configure(EntityTypeBuilder<Artist> builder)
    {
        // Table Name
        builder.ToTable("Artists");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.EnglishName)
               .HasMaxLength(100);

        builder.Property(e => e.ShortBio)
               .HasMaxLength(300);

        builder.Property(e => e.Biography)
               .HasMaxLength(2000);

        builder.Property(e => e.ImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.BannerImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.BannerGifUrl)
               .HasMaxLength(500);

        builder.Property(e => e.WebsiteUrl)
               .HasMaxLength(500);

        builder.Property(e => e.IsVerified)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.IsPremium)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.Status)
               .IsRequired()
               .HasDefaultValue(ArtistStatus.Pending);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        // Subscription-related properties
        builder.Property(e => e.Tier)
               .IsRequired()
               .HasDefaultValue(ProfileTier.Free);

        builder.Property(e => e.IsPrimaryProfile)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(e => e.Name)
               .HasDatabaseName("IX_Artists_Name");

        builder.HasIndex(e => e.UserId)
               .IsUnique()
               .HasDatabaseName("IX_Artists_UserId")
               .HasFilter("[UserId] IS NOT NULL");

        builder.HasIndex(e => e.PersonId)
               .HasDatabaseName("IX_Artists_PersonId");

        // Relationships
        builder.HasOne(a => a.User)
               .WithOne(u => u.ManagedArtist)
               .HasForeignKey<Artist>(a => a.UserId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.Person)
               .WithMany(p => p.Artists)
               .HasForeignKey(a => a.PersonId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(a => a.SocialLinks)
               .WithOne(sl => sl.Artist)
               .HasForeignKey(sl => sl.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.GalleryImages)
               .WithOne(gi => gi.Artist)
               .HasForeignKey(gi => gi.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Videos)
               .WithOne(v => v.Artist)
               .HasForeignKey(v => v.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.ArticleArtists)
               .WithOne(aa => aa.Artist)
               .HasForeignKey(aa => aa.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.EventArtists)
               .WithOne(ea => ea.Artist)
               .HasForeignKey(ea => ea.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);

        // Subscription relationship
        builder.HasOne(a => a.Subscription)
               .WithMany(s => s.CoveredArtists)
               .HasForeignKey(a => a.SubscriptionId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}