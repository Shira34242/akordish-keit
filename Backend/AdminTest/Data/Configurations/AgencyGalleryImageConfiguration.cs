using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AgencyGalleryImageConfiguration : IEntityTypeConfiguration<AgencyGalleryImage>
{
    public void Configure(EntityTypeBuilder<AgencyGalleryImage> builder)
    {
        builder.ToTable("AgencyGalleryImages");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.MediaType).IsRequired().HasMaxLength(20).HasDefaultValue("image");
        builder.Property(e => e.ImageUrl).HasMaxLength(500);
        builder.Property(e => e.VideoUrl).HasMaxLength(500);
        builder.Property(e => e.Title).HasMaxLength(200);
        builder.Property(e => e.Caption).HasMaxLength(200);
        builder.Property(e => e.DisplayOrder).IsRequired().HasDefaultValue(0);
        builder.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => e.AgencyId).HasDatabaseName("IX_AgencyGalleryImages_AgencyId");

        builder.HasOne(gi => gi.Agency)
            .WithMany(a => a.GalleryImages)
            .HasForeignKey(gi => gi.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
