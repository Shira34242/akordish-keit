using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class AdCampaignViewConfiguration : IEntityTypeConfiguration<AdCampaignView>
    {
        public void Configure(EntityTypeBuilder<AdCampaignView> builder)
        {
            builder.ToTable("AdCampaignViews");

            builder.HasKey(av => av.Id);

            // Configure foreign key relationships
            builder.HasOne(av => av.AdCampaign)
                .WithMany()
                .HasForeignKey(av => av.AdCampaignId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(av => av.User)
                .WithMany()
                .HasForeignKey(av => av.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Add indexes for performance
            // Index for logged-in users checking recent views
            builder.HasIndex(av => new { av.AdCampaignId, av.UserId, av.ViewedAt })
                .HasDatabaseName("IX_AdCampaignViews_AdCampaignId_UserId_ViewedAt");

            // Index for guest users checking recent views
            builder.HasIndex(av => new { av.AdCampaignId, av.IpAddress, av.UserAgent, av.ViewedAt })
                .HasDatabaseName("IX_AdCampaignViews_AdCampaignId_IpAddress_UserAgent_ViewedAt");

            // Default value for ViewedAt
            builder.Property(av => av.ViewedAt)
                .HasDefaultValueSql("GETUTCDATE()");
        }
    }
}
