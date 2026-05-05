using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistAlbumConfiguration : IEntityTypeConfiguration<ArtistAlbum>
{
    public void Configure(EntityTypeBuilder<ArtistAlbum> builder)
    {
        builder.ToTable("ArtistAlbums");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(e => e.CoverImageUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.ExternalUrl)
               .IsRequired()
               .HasMaxLength(500);

        builder.Property(e => e.DisplayOrder)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.IsActive)
               .IsRequired()
               .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArtistAlbums_ArtistId");

        builder.HasOne(album => album.Artist)
               .WithMany(artist => artist.Albums)
               .HasForeignKey(album => album.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
