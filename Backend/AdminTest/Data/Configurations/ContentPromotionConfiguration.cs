using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ContentPromotionConfiguration : IEntityTypeConfiguration<ContentPromotion>
{
    public void Configure(EntityTypeBuilder<ContentPromotion> builder)
    {
        builder.ToTable("ContentPromotions");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.TargetType).IsRequired();
        builder.Property(e => e.TargetId).IsRequired();
        builder.Property(e => e.Placement).IsRequired();
        builder.Property(e => e.Priority).IsRequired().HasDefaultValue(100);
        builder.Property(e => e.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(e => e.ShowOnHome).IsRequired().HasDefaultValue(false);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.CreatedBy).HasMaxLength(120);
        builder.Property(e => e.UpdatedBy).HasMaxLength(120);
        builder.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => new { e.TargetType, e.TargetId, e.Placement })
            .IsUnique()
            .HasDatabaseName("IX_ContentPromotions_Target_Placement");

        builder.HasIndex(e => new { e.IsActive, e.Placement, e.StartsAt, e.EndsAt })
            .HasDatabaseName("IX_ContentPromotions_Active_Placement");
    }
}
