using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class AdCampaignClickConfiguration : IEntityTypeConfiguration<AdCampaignClick>
    {
        public void Configure(EntityTypeBuilder<AdCampaignClick> builder)
        {
            builder.ToTable("AdCampaignClicks");

            builder.HasKey(ac => ac.Id);

            // Configure foreign key relationships
            builder.HasOne(ac => ac.AdCampaign)
                .WithMany()
                .HasForeignKey(ac => ac.AdCampaignId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ac => ac.User)
                .WithMany()
                .HasForeignKey(ac => ac.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Add indexes for performance
            // Index for logged-in users checking recent clicks
            builder.HasIndex(ac => new { ac.AdCampaignId, ac.UserId, ac.ClickedAt })
                .HasDatabaseName("IX_AdCampaignClicks_AdCampaignId_UserId_ClickedAt");

            // Index for guest users checking recent clicks
            builder.HasIndex(ac => new { ac.AdCampaignId, ac.IpAddress, ac.UserAgent, ac.ClickedAt })
                .HasDatabaseName("IX_AdCampaignClicks_AdCampaignId_IpAddress_UserAgent_ClickedAt");

            // Default value for ClickedAt
            builder.Property(ac => ac.ClickedAt)
                .HasDefaultValueSql("GETUTCDATE()");
        }
    }
}
