using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistGalleryImageConfiguration : IEntityTypeConfiguration<ArtistGalleryImage>
{
    public void Configure(EntityTypeBuilder<ArtistGalleryImage> builder)
    {
        // Table Name
        builder.ToTable("ArtistGalleryImages");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.ImageUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.Caption)
               .HasMaxLength(200);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArtistGalleryImages_ArtistId");

        // Relationships
        builder.HasOne(gi => gi.Artist)
               .WithMany(a => a.GalleryImages)
               .HasForeignKey(gi => gi.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
