using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class PodcastEpisodeConfiguration : IEntityTypeConfiguration<PodcastEpisode>
    {
        public void Configure(EntityTypeBuilder<PodcastEpisode> builder)
        {
            builder.ToTable("PodcastEpisodes");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.Title).IsRequired().HasMaxLength(250);
            builder.Property(e => e.Slug).IsRequired().HasMaxLength(260);
            builder.Property(e => e.Description).HasMaxLength(1000);
            builder.Property(e => e.SourceUrl).IsRequired().HasMaxLength(1000);
            builder.Property(e => e.EmbedUrl).IsRequired().HasMaxLength(1000);
            builder.Property(e => e.ThumbnailUrl).HasMaxLength(1000);
            builder.Property(e => e.Platform).IsRequired().HasMaxLength(80);
            builder.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(e => e.Podcast)
                .WithMany(p => p.Episodes)
                .HasForeignKey(e => e.PodcastId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => new { e.PodcastId, e.Slug })
                .IsUnique()
                .HasFilter("[IsDeleted] = 0")
                .HasDatabaseName("IX_PodcastEpisodes_Podcast_Slug");

            builder.HasIndex(e => new { e.IsDeleted, e.IsActive, e.PublishedAt })
                .HasDatabaseName("IX_PodcastEpisodes_Public_Latest");
        }
    }
}
