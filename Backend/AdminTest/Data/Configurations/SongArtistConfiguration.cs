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
               .IsRequired();

        builder.Property(sa => sa.Order)
               .IsRequired()
               .HasDefaultValue(1);

        // Indexes
        builder.HasIndex(sa => sa.SongId)
               .HasDatabaseName("IX_SongArtists_SongId");

        builder.HasIndex(sa => sa.ArtistId)
               .HasDatabaseName("IX_SongArtists_ArtistId");

        // Unique constraint: אותו אמן לא יכול להופיע פעמיים באותו שיר
        builder.HasIndex(sa => new { sa.SongId, sa.ArtistId })
               .IsUnique()
               .HasDatabaseName("IX_SongArtists_SongId_ArtistId");

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