using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class PodcastEpisodeArtistConfiguration : IEntityTypeConfiguration<PodcastEpisodeArtist>
{
    public void Configure(EntityTypeBuilder<PodcastEpisodeArtist> builder)
    {
        builder.ToTable("PodcastEpisodeArtists");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => new { e.PodcastEpisodeId, e.ArtistId })
            .IsUnique()
            .HasDatabaseName("IX_PodcastEpisodeArtists_EpisodeId_ArtistId");

        builder.HasIndex(e => e.ArtistId)
            .HasDatabaseName("IX_PodcastEpisodeArtists_ArtistId");

        builder.HasOne(e => e.PodcastEpisode)
            .WithMany(e => e.PodcastEpisodeArtists)
            .HasForeignKey(e => e.PodcastEpisodeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Artist)
            .WithMany(a => a.PodcastEpisodeArtists)
            .HasForeignKey(e => e.ArtistId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(e => !e.PodcastEpisode.IsDeleted);
    }
}
