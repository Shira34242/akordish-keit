using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class MarketingCampaignEventConfiguration : IEntityTypeConfiguration<MarketingCampaignEvent>
{
    public void Configure(EntityTypeBuilder<MarketingCampaignEvent> builder)
    {
        builder.ToTable("MarketingCampaignEvents");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.EventType).HasMaxLength(20).IsRequired();
        builder.Property(x => x.VisitorId).HasMaxLength(64).IsRequired();
        builder.Property(x => x.PagePath).HasMaxLength(500);
        builder.Property(x => x.Referrer).HasMaxLength(500);
        builder.Property(x => x.IpAddress).HasMaxLength(64);
        builder.Property(x => x.UserAgent).HasMaxLength(500);
        builder.Property(x => x.OccurredAt).HasDefaultValueSql("GETUTCDATE()");
        builder.HasIndex(x => new { x.MarketingCampaignId, x.EventType, x.OccurredAt });
        builder.HasIndex(x => new { x.MarketingCampaignId, x.VisitorId, x.EventType });
        builder.HasIndex(x => new { x.UserId, x.EventType });
        builder.HasOne(x => x.MarketingCampaign)
            .WithMany(x => x.Events)
            .HasForeignKey(x => x.MarketingCampaignId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
