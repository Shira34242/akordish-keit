using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleCategoryEntityConfiguration : IEntityTypeConfiguration<ArticleCategoryEntity>
{
    public void Configure(EntityTypeBuilder<ArticleCategoryEntity> builder)
    {
        // Table Name
        builder.ToTable("ArticleCategories");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Id)
               .ValueGeneratedNever(); // We'll manually set IDs from the enum

        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.DisplayName)
               .IsRequired()
               .HasMaxLength(100);

        // Indexes
        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_ArticleCategories_Name");

        // Relationships
        builder.HasMany(e => e.ArticleCategories)
               .WithOne(ac => ac.Category)
               .HasForeignKey(ac => ac.CategoryId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
