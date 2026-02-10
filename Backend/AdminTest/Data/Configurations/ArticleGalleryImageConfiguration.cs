using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleGalleryImageConfiguration : IEntityTypeConfiguration<ArticleGalleryImage>
{
    public void Configure(EntityTypeBuilder<ArticleGalleryImage> builder)
    {
        // Table Name
        builder.ToTable("ArticleGalleryImages");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.ArticleId)
               .IsRequired();

        builder.Property(e => e.ImageUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.Caption)
               .HasMaxLength(500);

        builder.Property(e => e.DisplayOrder)
               .IsRequired();

        // Indexes
        builder.HasIndex(e => e.ArticleId)
               .HasDatabaseName("IX_ArticleGalleryImages_ArticleId");

        builder.HasIndex(e => new { e.ArticleId, e.DisplayOrder })
               .HasDatabaseName("IX_ArticleGalleryImages_ArticleId_DisplayOrder");

        // Relationships
        builder.HasOne(e => e.Article)
               .WithMany(a => a.GalleryImages)
               .HasForeignKey(e => e.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
