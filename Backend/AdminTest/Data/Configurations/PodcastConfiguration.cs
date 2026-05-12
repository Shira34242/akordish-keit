using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class PodcastConfiguration : IEntityTypeConfiguration<Podcast>
    {
        public void Configure(EntityTypeBuilder<Podcast> builder)
        {
            builder.ToTable("Podcasts");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
            builder.Property(p => p.Slug).IsRequired().HasMaxLength(220);
            builder.Property(p => p.Description).HasMaxLength(1000);
            builder.Property(p => p.ImageUrl).HasMaxLength(1000);
            builder.Property(p => p.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            builder.HasIndex(p => p.Slug)
                .IsUnique()
                .HasFilter("[IsDeleted] = 0")
                .HasDatabaseName("IX_Podcasts_Slug");

            builder.HasIndex(p => new { p.IsDeleted, p.IsActive, p.DisplayOrder })
                .HasDatabaseName("IX_Podcasts_Public");
        }
    }
}
