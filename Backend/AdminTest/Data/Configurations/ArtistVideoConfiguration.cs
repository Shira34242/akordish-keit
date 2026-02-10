using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistVideoConfiguration : IEntityTypeConfiguration<ArtistVideo>
{
    public void Configure(EntityTypeBuilder<ArtistVideo> builder)
    {
        // Table Name
        builder.ToTable("ArtistVideos");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.VideoUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.Title)
               .HasMaxLength(200);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArtistVideos_ArtistId");

        // Relationships
        builder.HasOne(v => v.Artist)
               .WithMany(a => a.Videos)
               .HasForeignKey(v => v.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
