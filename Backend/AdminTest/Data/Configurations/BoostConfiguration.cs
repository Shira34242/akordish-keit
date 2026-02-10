using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

/// <summary>
/// תצורת Entity Framework עבור Boost
/// </summary>
public class BoostConfiguration : IEntityTypeConfiguration<Boost>
{
    public void Configure(EntityTypeBuilder<Boost> builder)
    {
        // Table Name
        builder.ToTable("Boosts");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.ServiceProviderId)
               .IsRequired();

        builder.Property(e => e.Price)
               .IsRequired()
               .HasColumnType("decimal(10,2)");

        builder.Property(e => e.ExternalPaymentId)
               .HasMaxLength(255);

        builder.Property(e => e.Type)
               .IsRequired()
               .HasDefaultValue(BoostType.TopOfRecommended);

        builder.Property(e => e.PurchaseDate)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsActive)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(e => e.ServiceProviderId)
               .HasDatabaseName("IX_Boosts_ServiceProviderId");

        builder.HasIndex(e => e.IsActive)
               .HasDatabaseName("IX_Boosts_IsActive");

        builder.HasIndex(e => new { e.Type, e.IsActive })
               .HasDatabaseName("IX_Boosts_Type_IsActive");

        // Relationships - defined in MusicServiceProviderConfiguration
        // builder.HasOne(b => b.ServiceProvider)
        //        .WithMany(sp => sp.Boosts)
        //        .HasForeignKey(b => b.ServiceProviderId)
        //        .OnDelete(DeleteBehavior.Cascade);
    }
}
