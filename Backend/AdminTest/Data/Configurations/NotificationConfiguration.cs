using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(160);

        builder.Property(n => n.Message)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(n => n.RelatedEntityType)
            .HasMaxLength(80);

        builder.Property(n => n.ActionUrl)
            .HasMaxLength(500);

        builder.Property(n => n.MediaUrl)
            .HasMaxLength(1000);

        builder.Property(n => n.MediaType)
            .HasMaxLength(40);

        builder.Property(n => n.MediaThumbnailUrl)
            .HasMaxLength(1000);

        builder.Property(n => n.MediaAltText)
            .HasMaxLength(200);

        builder.Property(n => n.CampaignName)
            .HasMaxLength(160);

        builder.Property(n => n.AudienceLabel)
            .HasMaxLength(300);

        builder.Property(n => n.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(n => n.IsRead)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(n => n.IsDeleted)
            .IsRequired()
            .HasDefaultValue(false);

        builder.HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(n => n.CreatedByUser)
            .WithMany()
            .HasForeignKey(n => n.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(n => new { n.UserId, n.IsRead, n.IsDeleted, n.CreatedAt })
            .HasDatabaseName("IX_Notifications_User_Read_Deleted_Created");

        builder.HasIndex(n => new { n.RelatedEntityType, n.RelatedEntityId })
            .HasDatabaseName("IX_Notifications_RelatedEntity");
    }
}
