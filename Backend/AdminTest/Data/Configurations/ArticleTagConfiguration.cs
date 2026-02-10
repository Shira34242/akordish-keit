using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleTagConfiguration : IEntityTypeConfiguration<ArticleTag>
{
    public void Configure(EntityTypeBuilder<ArticleTag> builder)
    {
        // Table Name
        builder.ToTable("ArticleTags");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.ArticleId)
               .IsRequired();

        builder.Property(e => e.TagId)
               .IsRequired();

        // Indexes
        builder.HasIndex(e => new { e.ArticleId, e.TagId })
               .IsUnique()
               .HasDatabaseName("IX_ArticleTags_ArticleId_TagId");

        builder.HasIndex(e => e.TagId)
               .HasDatabaseName("IX_ArticleTags_TagId");

        // Relationships
        builder.HasOne(e => e.Article)
               .WithMany(a => a.ArticleTags)
               .HasForeignKey(e => e.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Tag)
               .WithMany()
               .HasForeignKey(e => e.TagId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
