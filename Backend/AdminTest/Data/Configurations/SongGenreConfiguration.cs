using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class SongGenreConfiguration : IEntityTypeConfiguration<SongGenre>
{
    public void Configure(EntityTypeBuilder<SongGenre> builder)
    {
        // Table Name
        builder.ToTable("SongGenres");

        // Composite Primary Key
        builder.HasKey(sg => new { sg.SongId, sg.GenreId });

        // Relationships
        builder.HasOne(sg => sg.Song)
               .WithMany(s => s.SongGenres)
               .HasForeignKey(sg => sg.SongId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sg => sg.Genre)
               .WithMany(g => g.SongGenres)
               .HasForeignKey(sg => sg.GenreId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}