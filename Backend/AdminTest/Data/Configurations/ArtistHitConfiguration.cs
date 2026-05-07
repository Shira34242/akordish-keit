using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistHitConfiguration : IEntityTypeConfiguration<ArtistHit>
{
    public void Configure(EntityTypeBuilder<ArtistHit> builder)
    {
        builder.ToTable("ArtistHits");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(e => e.ImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.YouTubeUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.IsActive)
               .IsRequired()
               .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArtistHits_ArtistId");

        builder.HasOne(hit => hit.Artist)
               .WithMany(artist => artist.Hits)
               .HasForeignKey(hit => hit.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
