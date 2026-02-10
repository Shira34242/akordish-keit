using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderGalleryImageConfiguration : IEntityTypeConfiguration<MusicServiceProviderGalleryImage>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProviderGalleryImage> builder)
        {
            // Table name
            builder.ToTable("MusicServiceProviderGalleryImages");

            // Primary Key
            builder.HasKey(g => g.Id);

            // Required fields
            builder.Property(g => g.ServiceProviderId)
                .IsRequired();

            builder.Property(g => g.ImageUrl)
                .IsRequired()
                .HasMaxLength(500);

            // Optional fields
            builder.Property(g => g.Caption)
                .HasMaxLength(500);

            // Default values
            builder.Property(g => g.Order)
                .HasDefaultValue(0);

            builder.Property(g => g.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

            // Relationships

            // ServiceProvider (Many-to-One)
            // הקשר מוגדר ב-ServiceProviderConfiguration

            // Indexes
            builder.HasIndex(g => g.ServiceProviderId);
            builder.HasIndex(g => g.Order);
        }
    }
}
