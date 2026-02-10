using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderCategoryMappingConfiguration : IEntityTypeConfiguration<MusicServiceProviderCategoryMapping>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProviderCategoryMapping> builder)
        {
            // Table name
            builder.ToTable("MusicServiceProviderCategoryMappings");

            // Primary Key
            builder.HasKey(m => m.Id);

            // Required fields
            builder.Property(m => m.ServiceProviderId)
                .IsRequired();

            builder.Property(m => m.CategoryId)
                .IsRequired();

            // Optional fields
            builder.Property(m => m.SubCategory)
                .HasMaxLength(200);

            // Relationships

            // ServiceProvider (Many-to-One)
            // הקשר מוגדר ב-ServiceProviderConfiguration

            // Category (Many-to-One)
            // הקשר מוגדר ב-ServiceProviderCategoryConfiguration

            // Indexes
            builder.HasIndex(m => m.ServiceProviderId);
            builder.HasIndex(m => m.CategoryId);

            // Unique constraint - כל בעל מקצוע יכול להיות בכל קטגוריה רק פעם אחת
            builder.HasIndex(m => new { m.ServiceProviderId, m.CategoryId })
                .IsUnique();
        }
    }
}
