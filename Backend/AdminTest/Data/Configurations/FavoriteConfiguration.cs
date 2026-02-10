using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class FavoriteConfiguration : IEntityTypeConfiguration<Favorite>
{
    public void Configure(EntityTypeBuilder<Favorite> builder)
    {
        // Table Name
        builder.ToTable("Favorites");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => new { e.UserId, e.SongId })
               .IsUnique()
               .HasDatabaseName("IX_Favorites_UserId_SongId");

        builder.HasIndex(e => e.UserId)
               .HasDatabaseName("IX_Favorites_UserId");

        builder.HasIndex(e => e.SongId)
               .HasDatabaseName("IX_Favorites_SongId");

        // Relationships
        builder.HasOne(f => f.User)
               .WithMany(u => u.Favorites)
               .HasForeignKey(f => f.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(f => f.Song)
               .WithMany(s => s.Favorites)
               .HasForeignKey(f => f.SongId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}