using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderCategoryConfiguration : IEntityTypeConfiguration<MusicServiceProviderCategory>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProviderCategory> builder)
        {
            // Table name
            builder.ToTable("MusicServiceProviderCategories");

            // Primary Key
            builder.HasKey(c => c.Id);

            // Required fields
            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(200);

            // Optional fields with max length
            builder.Property(c => c.Description)
                .HasMaxLength(1000);

            builder.Property(c => c.IconUrl)
                .HasMaxLength(500);

            // Default values
            builder.Property(c => c.IsActive)
                .HasDefaultValue(true);

            builder.Property(c => c.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

            // Relationships

            // ServiceProviders (One-to-Many through mapping table)
            builder.HasMany(c => c.ServiceProviders)
                .WithOne(m => m.Category)
                .HasForeignKey(m => m.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            builder.HasIndex(c => c.Name)
                .IsUnique();

            builder.HasIndex(c => c.IsActive);
        }
    }
}
