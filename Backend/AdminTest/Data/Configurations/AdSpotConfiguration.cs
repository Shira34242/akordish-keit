using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AdSpotConfiguration : IEntityTypeConfiguration<AdSpot>
{
    public void Configure(EntityTypeBuilder<AdSpot> builder)
    {
        // Table Name
        builder.ToTable("AdSpots");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.TechnicalId)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.Dimensions)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.IsActive)
               .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.Description)
               .HasMaxLength(1000);

        // Indexes
        builder.HasIndex(e => e.TechnicalId)
               .IsUnique()
               .HasDatabaseName("IX_AdSpots_TechnicalId");

        builder.HasIndex(e => e.Name)
               .HasDatabaseName("IX_AdSpots_Name");
    }
}
