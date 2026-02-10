using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using AkordishKeit.Models.Entities;

namespace AkordishKeit.Data.Configurations;

public class SongConfiguration : IEntityTypeConfiguration<Song>
{
    public void Configure(EntityTypeBuilder<Song> builder)
    {
        // Table Name
        builder.ToTable("Songs");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Title)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(e => e.YouTubeUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.SpotifyUrl)
               .HasMaxLength(500);

        builder.Property(e => e.ImageUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.IsApproved)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.LyricsWithChords)
               .IsRequired()
               .HasColumnType("nvarchar(MAX)");

        builder.Property(e => e.ViewCount)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.PlayCount)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.Language)
               .HasMaxLength(20);

        builder.Property(e => e.DurationSeconds);

        // Indexes
        builder.HasIndex(e => e.Title)
               .HasDatabaseName("IX_Songs_Title");

        builder.HasIndex(e => e.IsApproved)
               .HasDatabaseName("IX_Songs_IsApproved");

        builder.HasIndex(e => e.CreatedAt)
               .HasDatabaseName("IX_Songs_CreatedAt");

        builder.HasIndex(e => new { e.IsApproved, e.IsDeleted })
               .HasDatabaseName("IX_Songs_IsApproved_IsDeleted");

        builder.HasIndex(e => e.ViewCount)
               .HasDatabaseName("IX_Songs_ViewCount");

        builder.HasIndex(e => new { e.Language, e.IsApproved })
               .HasDatabaseName("IX_Songs_Language_IsApproved");

        // Relationships - Composer
        builder.HasOne(s => s.Composer)
               .WithMany(p => p.ComposedSongs)
               .HasForeignKey(s => s.ComposerId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - Lyricist
        builder.HasOne(s => s.Lyricist)
               .WithMany(p => p.WrittenSongs)
               .HasForeignKey(s => s.LyricistId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - Arranger
        builder.HasOne(s => s.Arranger)
               .WithMany(p => p.ArrangedSongs)
               .HasForeignKey(s => s.ArrangerId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - OriginalKey
        builder.HasOne(s => s.OriginalKey)
               .WithMany(k => k.SongsInOriginalKey)
               .HasForeignKey(s => s.OriginalKeyId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - EasyKey
        builder.HasOne(s => s.EasyKey)
               .WithMany(k => k.SongsInEasyKey)
               .HasForeignKey(s => s.EasyKeyId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - UploadedBy
        builder.HasOne(s => s.UploadedBy)
               .WithMany(u => u.UploadedSongs)
               .HasForeignKey(s => s.UploadedByUserId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}