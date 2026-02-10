using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class SongViewConfiguration : IEntityTypeConfiguration<SongView>
    {
        public void Configure(EntityTypeBuilder<SongView> builder)
        {
            builder.ToTable("SongViews");

            builder.HasKey(sv => sv.Id);

            // Configure foreign key relationships
            builder.HasOne(sv => sv.Song)
                .WithMany()
                .HasForeignKey(sv => sv.SongId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(sv => sv.User)
                .WithMany()
                .HasForeignKey(sv => sv.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Add indexes for performance
            // Index for logged-in users checking recent views
            builder.HasIndex(sv => new { sv.SongId, sv.UserId, sv.ViewedAt })
                .HasDatabaseName("IX_SongViews_SongId_UserId_ViewedAt");

            // Index for guest users checking recent views
            builder.HasIndex(sv => new { sv.SongId, sv.IpAddress, sv.UserAgent, sv.ViewedAt })
                .HasDatabaseName("IX_SongViews_SongId_IpAddress_UserAgent_ViewedAt");

            // Default value for ViewedAt
            builder.Property(sv => sv.ViewedAt)
                .HasDefaultValueSql("GETUTCDATE()");
        }
    }
}
