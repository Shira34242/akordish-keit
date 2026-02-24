using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using AkordishKeit.Models.Entities;

namespace AkordishKeit.Data.Configurations;

public class SongArtistConfiguration : IEntityTypeConfiguration<SongArtist>
{
    public void Configure(EntityTypeBuilder<SongArtist> builder)
    {
        // Table Name
        builder.ToTable("SongArtists");

        // Primary Key
        builder.HasKey(sa => sa.Id);

        // Properties
        builder.Property(sa => sa.SongId)
               .IsRequired();

        builder.Property(sa => sa.ArtistId)
               .IsRequired(false); // nullable - לתמיכה באמנים זמניים

        builder.Property(sa => sa.Order)
               .IsRequired()
               .HasDefaultValue(1);

        builder.Property(sa => sa.TempArtistName)
               .HasMaxLength(200);

        builder.Property(sa => sa.IsTemporary)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(sa => sa.SongId)
               .HasDatabaseName("IX_SongArtists_SongId");

        builder.HasIndex(sa => sa.ArtistId)
               .HasDatabaseName("IX_SongArtists_ArtistId");

        // Index על אמנים זמניים
        builder.HasIndex(sa => sa.IsTemporary)
               .HasDatabaseName("IX_SongArtists_IsTemporary");

        // Relationships - Song
        builder.HasOne(sa => sa.Song)
               .WithMany(s => s.SongArtists)
               .HasForeignKey(sa => sa.SongId)
               .OnDelete(DeleteBehavior.Cascade);

        // Relationships - Artist
        builder.HasOne(sa => sa.Artist)
               .WithMany(a => a.SongArtists)
               .HasForeignKey(sa => sa.ArtistId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}