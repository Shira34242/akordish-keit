using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleConfiguration : IEntityTypeConfiguration<Article>
{
    public void Configure(EntityTypeBuilder<Article> builder)
    {
        // Table Name
        builder.ToTable("Articles");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Title)
               .IsRequired()
               .HasMaxLength(250);

        builder.Property(e => e.Subtitle)
               .HasMaxLength(500);

        builder.Property(e => e.Content)
               .IsRequired()
               .HasColumnType("nvarchar(max)");

        builder.Property(e => e.FeaturedImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.PublishDate)
               .IsRequired();

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.UpdatedAt);

        builder.Property(e => e.AuthorName)
               .HasMaxLength(100);

        builder.Property(e => e.ContentType)
               .IsRequired();

        builder.Property(e => e.Slug)
               .IsRequired()
               .HasMaxLength(300);

        builder.Property(e => e.CanonicalUrl)
               .HasMaxLength(500);

        builder.Property(e => e.VideoEmbedUrl)
               .HasMaxLength(500);

        builder.Property(e => e.AudioEmbedUrl)
               .HasMaxLength(500);

        builder.Property(e => e.ImageCredit)
               .HasMaxLength(200);

        builder.Property(e => e.ShortDescription)
               .HasMaxLength(1000);

        builder.Property(e => e.IsFeatured)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.Status)
               .IsRequired();

        builder.Property(e => e.ScheduledDate);

        builder.Property(e => e.IsPremium)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.MetaTitle)
               .HasMaxLength(250);

        builder.Property(e => e.MetaDescription)
               .HasMaxLength(500);

        builder.Property(e => e.OpenGraphImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.ViewCount)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.LikeCount)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.ReadTimeMinutes);

        builder.Property(e => e.CreatedBy)
               .HasMaxLength(100);

        builder.Property(e => e.UpdatedBy)
               .HasMaxLength(100);

        builder.Property(e => e.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        // Slug with case-insensitive uniqueness (using computed column with lowercase)
        builder.HasIndex(e => e.Slug)
               .IsUnique()
               .HasDatabaseName("IX_Articles_Slug");

        builder.HasIndex(e => e.IsDeleted)
               .HasDatabaseName("IX_Articles_IsDeleted");

        // Composite indexes for common queries (order matters!)
        builder.HasIndex(e => new { e.IsFeatured, e.PublishDate })
               .IsDescending(false, true)
               .HasDatabaseName("IX_Articles_IsFeatured_PublishDate");

        builder.HasIndex(e => new { e.ContentType, e.PublishDate })
               .IsDescending(false, true)
               .HasDatabaseName("IX_Articles_ContentType_PublishDate");

        builder.HasIndex(e => new { e.IsFeatured, e.DisplayOrder })
               .HasDatabaseName("IX_Articles_IsFeatured_DisplayOrder");

        // Relationships
        builder.HasMany(e => e.ArticleTags)
               .WithOne(at => at.Article)
               .HasForeignKey(at => at.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.GalleryImages)
               .WithOne(gi => gi.Article)
               .HasForeignKey(gi => gi.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.ArticleCategories)
               .WithOne(ac => ac.Article)
               .HasForeignKey(ac => ac.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        // Query Filter for soft delete
        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
