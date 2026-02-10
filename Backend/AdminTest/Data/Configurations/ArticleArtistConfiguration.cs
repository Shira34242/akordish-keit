using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleArtistConfiguration : IEntityTypeConfiguration<ArticleArtist>
{
    public void Configure(EntityTypeBuilder<ArticleArtist> builder)
    {
        // Table Name
        builder.ToTable("ArticleArtists");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => new { e.ArticleId, e.ArtistId })
               .IsUnique()
               .HasDatabaseName("IX_ArticleArtists_ArticleId_ArtistId");

        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArticleArtists_ArtistId");

        // Relationships
        builder.HasOne(aa => aa.Article)
               .WithMany(a => a.ArticleArtists)
               .HasForeignKey(aa => aa.ArticleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(aa => aa.Artist)
               .WithMany(a => a.ArticleArtists)
               .HasForeignKey(aa => aa.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
