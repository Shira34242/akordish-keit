using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class PodcastEpisodeViewConfiguration : IEntityTypeConfiguration<PodcastEpisodeView>
    {
        public void Configure(EntityTypeBuilder<PodcastEpisodeView> builder)
        {
            builder.ToTable("PodcastEpisodeViews");

            builder.HasKey(v => v.Id);

            builder.Property(v => v.PodcastEpisodeId)
                .IsRequired();

            builder.Property(v => v.IpAddress)
                .HasMaxLength(45);

            builder.Property(v => v.UserAgent)
                .HasMaxLength(500);

            builder.Property(v => v.Referrer)
                .HasMaxLength(500);

            builder.Property(v => v.ViewedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(v => v.PodcastEpisode)
                .WithMany()
                .HasForeignKey(v => v.PodcastEpisodeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(v => v.User)
                .WithMany()
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(v => new { v.PodcastEpisodeId, v.ViewedAt })
                .HasDatabaseName("IX_PodcastEpisodeViews_Episode_ViewedAt");

            builder.HasIndex(v => new { v.PodcastEpisodeId, v.UserId, v.ViewedAt })
                .HasDatabaseName("IX_PodcastEpisodeViews_Episode_User_ViewedAt");

            builder.HasIndex(v => new { v.PodcastEpisodeId, v.IpAddress, v.UserAgent, v.ViewedAt })
                .HasDatabaseName("IX_PodcastEpisodeViews_Episode_Guest_ViewedAt");

            builder.HasIndex(v => v.ViewedAt)
                .HasDatabaseName("IX_PodcastEpisodeViews_ViewedAt");

            builder.HasQueryFilter(v => !v.PodcastEpisode.IsDeleted);
        }
    }
}
