using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class EventViewConfiguration : IEntityTypeConfiguration<EventView>
    {
        public void Configure(EntityTypeBuilder<EventView> builder)
        {
            builder.ToTable("EventViews");

            builder.HasKey(ev => ev.Id);

            builder.Property(ev => ev.IpAddress).HasMaxLength(45);
            builder.Property(ev => ev.UserAgent).HasMaxLength(500);

            builder.Property(ev => ev.ViewedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(ev => ev.Event)
                .WithMany()
                .HasForeignKey(ev => ev.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ev => ev.User)
                .WithMany()
                .HasForeignKey(ev => ev.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(ev => new { ev.EventId, ev.UserId, ev.ViewedAt })
                .HasDatabaseName("IX_EventViews_EventId_UserId_ViewedAt");

            builder.HasIndex(ev => new { ev.EventId, ev.IpAddress, ev.UserAgent, ev.ViewedAt })
                .HasDatabaseName("IX_EventViews_EventId_IpAddress_UserAgent_ViewedAt");
        }
    }
}
