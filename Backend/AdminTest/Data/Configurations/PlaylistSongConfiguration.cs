using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class PlaylistSongConfiguration : IEntityTypeConfiguration<PlaylistSong>
{
    public void Configure(EntityTypeBuilder<PlaylistSong> builder)
    {
        // Table Name
        builder.ToTable("PlaylistSongs");

        // Primary Key
        builder.HasKey(ps => ps.Id);

        // Properties
        builder.Property(ps => ps.Order)
            .IsRequired();

        builder.Property(ps => ps.AddedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        // אינדקס משולב למניעת שיר כפול באותה רשימה
        builder.HasIndex(ps => new { ps.PlaylistId, ps.SongId })
            .IsUnique()
            .HasDatabaseName("IX_PlaylistSongs_PlaylistId_SongId");

        // אינדקס לחיפוש שירים לפי רשימה
        builder.HasIndex(ps => ps.PlaylistId)
            .HasDatabaseName("IX_PlaylistSongs_PlaylistId");

        // אינדקס לסדר השירים
        builder.HasIndex(ps => new { ps.PlaylistId, ps.Order })
            .HasDatabaseName("IX_PlaylistSongs_PlaylistId_Order");

        // Relationships
        builder.HasOne(ps => ps.Playlist)
            .WithMany(p => p.PlaylistSongs)
            .HasForeignKey(ps => ps.PlaylistId)
            .OnDelete(DeleteBehavior.Cascade); // מחיקת רשימה = מחיקת כל השירים שבה

        builder.HasOne(ps => ps.Song)
            .WithMany()
            .HasForeignKey(ps => ps.SongId)
            .OnDelete(DeleteBehavior.Cascade); // מחיקת שיר = הסרה מכל הרשימות
    }
}
