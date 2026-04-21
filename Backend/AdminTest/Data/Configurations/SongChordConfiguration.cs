using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class SongChordConfiguration : IEntityTypeConfiguration<SongChord>
{
    public void Configure(EntityTypeBuilder<SongChord> builder)
    {
        builder.ToTable("SongChords");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.DisplayChordName)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(e => e.NormalizedChordName)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(e => e.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(e => e.Song)
            .WithMany(s => s.SongChords)
            .HasForeignKey(e => e.SongId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.SongId, e.NormalizedChordName })
            .IsUnique()
            .HasDatabaseName("IX_SongChords_Song_Chord");

        builder.HasIndex(e => new { e.NormalizedChordName, e.SongId })
            .HasDatabaseName("IX_SongChords_Chord_Song");
    }
}
