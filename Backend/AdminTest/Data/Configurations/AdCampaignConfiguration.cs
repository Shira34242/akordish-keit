using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AdCampaignConfiguration : IEntityTypeConfiguration<AdCampaign>
{
    public void Configure(EntityTypeBuilder<AdCampaign> builder)
    {
        // Table Name
        builder.ToTable("AdCampaigns");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(e => e.KnownUrl)
               .HasMaxLength(500);

        builder.Property(e => e.MediaUrl)
               .HasMaxLength(500);

        builder.Property(e => e.MobileMediaUrl)
               .HasMaxLength(500);

        builder.Property(e => e.Priority)
               .HasDefaultValue(1);

        builder.Property(e => e.Budget)
               .HasColumnType("decimal(18,2)");

        builder.Property(e => e.ViewCount)
               .HasDefaultValue(0);

        builder.Property(e => e.ClickCount)
               .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => e.Name)
               .HasDatabaseName("IX_AdCampaigns_Name");

        builder.HasIndex(e => e.Status)
               .HasDatabaseName("IX_AdCampaigns_Status");

        builder.HasIndex(e => new { e.StartDate, e.EndDate })
               .HasDatabaseName("IX_AdCampaigns_DateRange");

        builder.HasIndex(e => e.AdSpotId)
               .HasDatabaseName("IX_AdCampaigns_AdSpotId");

        builder.HasIndex(e => e.ClientId)
               .HasDatabaseName("IX_AdCampaigns_ClientId");

        // Relationships
        builder.HasOne(c => c.AdSpot)
               .WithMany(s => s.Campaigns)
               .HasForeignKey(c => c.AdSpotId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Client)
               .WithMany(cl => cl.Campaigns)
               .HasForeignKey(c => c.ClientId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.CreatedByUser)
               .WithMany()
               .HasForeignKey(c => c.CreatedByUserId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(c => c.UpdatedByUser)
               .WithMany()
               .HasForeignKey(c => c.UpdatedByUserId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
