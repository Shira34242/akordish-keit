using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class NotificationGroupConfiguration : IEntityTypeConfiguration<NotificationGroup>
{
    public void Configure(EntityTypeBuilder<NotificationGroup> builder)
    {
        builder.ToTable("NotificationGroups");

        builder.HasKey(group => group.Id);

        builder.Property(group => group.Name)
            .IsRequired()
            .HasMaxLength(160);

        builder.Property(group => group.Description)
            .HasMaxLength(500);

        builder.Property(group => group.ImageUrl)
            .HasMaxLength(1000);

        builder.Property(group => group.AddressContains)
            .HasMaxLength(200);

        builder.Property(group => group.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(group => group.CreatedByUser)
            .WithMany()
            .HasForeignKey(group => group.CreatedByUserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(group => new { group.IsDeleted, group.CreatedAt })
            .HasDatabaseName("IX_NotificationGroups_Deleted_Created");
    }
}
