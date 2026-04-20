using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class NotificationGroupMemberConfiguration : IEntityTypeConfiguration<NotificationGroupMember>
{
    public void Configure(EntityTypeBuilder<NotificationGroupMember> builder)
    {
        builder.ToTable("NotificationGroupMembers");

        builder.HasKey(member => new { member.NotificationGroupId, member.UserId });

        builder.Property(member => member.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(member => member.NotificationGroup)
            .WithMany(group => group.Members)
            .HasForeignKey(member => member.NotificationGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(member => member.User)
            .WithMany()
            .HasForeignKey(member => member.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(member => member.UserId)
            .HasDatabaseName("IX_NotificationGroupMembers_UserId");
    }
}
