using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleArticleCategoryConfiguration : IEntityTypeConfiguration<ArticleArticleCategory>
{
    public void Configure(EntityTypeBuilder<ArticleArticleCategory> builder)
    {
        // Table Name
        builder.ToTable("ArticleArticleCategories");

        // Composite Primary Key
        builder.HasKey(e => new { e.ArticleId, e.CategoryId });

        // Relationships
        builder.HasOne(e => e.Article)
               .WithMany(a => a.ArticleCategories)
               .HasForeignKey(e => e.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Category)
               .WithMany(c => c.ArticleCategories)
               .HasForeignKey(e => e.CategoryId)
               .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(e => e.ArticleId)
               .HasDatabaseName("IX_ArticleArticleCategories_ArticleId");

        builder.HasIndex(e => e.CategoryId)
               .HasDatabaseName("IX_ArticleArticleCategories_CategoryId");
    }
}
