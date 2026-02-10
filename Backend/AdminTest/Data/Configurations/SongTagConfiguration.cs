using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class SongTagConfiguration : IEntityTypeConfiguration<SongTag>
{
    public void Configure(EntityTypeBuilder<SongTag> builder)
    {
        // Table Name
        builder.ToTable("SongTags");

        // Composite Primary Key
        builder.HasKey(st => new { st.SongId, st.TagId });

        // Relationships
        builder.HasOne(st => st.Song)
               .WithMany(s => s.SongTags)
               .HasForeignKey(st => st.SongId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(st => st.Tag)
               .WithMany(t => t.SongTags)
               .HasForeignKey(st => st.TagId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}