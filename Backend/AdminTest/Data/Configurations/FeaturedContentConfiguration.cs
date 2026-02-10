using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class FeaturedContentConfiguration : IEntityTypeConfiguration<FeaturedContent>
    {
        public void Configure(EntityTypeBuilder<FeaturedContent> builder)
        {
            builder.ToTable("FeaturedContents");

            builder.HasKey(fc => fc.Id);

            builder.Property(fc => fc.ArticleId)
                .IsRequired();

            builder.Property(fc => fc.DisplayOrder)
                .IsRequired();

            builder.Property(fc => fc.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            builder.Property(fc => fc.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(fc => fc.UpdatedAt);

            builder.Property(fc => fc.CreatedBy)
                .HasMaxLength(100);

            builder.Property(fc => fc.UpdatedBy)
                .HasMaxLength(100);

            // Relationships
            builder.HasOne(fc => fc.Article)
                .WithMany()
                .HasForeignKey(fc => fc.ArticleId)
                .OnDelete(DeleteBehavior.Restrict); // לא למחוק כתבה אם היא בתוכן מרכזי

            // Indexes
            builder.HasIndex(fc => fc.ArticleId)
                .IsUnique(); // כל כתבה יכולה להיות רק פעם אחת בתוכן מרכזי

            builder.HasIndex(fc => new { fc.IsActive, fc.DisplayOrder })
                .HasDatabaseName("IX_FeaturedContents_Active_Order");
        }
    }
}
