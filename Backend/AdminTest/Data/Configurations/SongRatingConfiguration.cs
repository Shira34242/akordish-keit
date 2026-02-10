using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class SongRatingConfiguration : IEntityTypeConfiguration<SongRating>
{
    public void Configure(EntityTypeBuilder<SongRating> builder)
    {
        // Table Name
        builder.ToTable("SongRatings");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Rating)
               .IsRequired();

        builder.Property(e => e.Comment)
               .HasMaxLength(500);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => new { e.UserId, e.SongId })
               .IsUnique()
               .HasDatabaseName("IX_SongRatings_UserId_SongId");

        builder.HasIndex(e => e.SongId)
               .HasDatabaseName("IX_SongRatings_SongId");


        builder.HasIndex(e => new { e.SongId, e.Rating })
               .HasDatabaseName("IX_SongRatings_SongId_Rating");

        builder.HasIndex(e => e.UserId)
               .HasDatabaseName("IX_SongRatings_UserId");

        // Relationships
        builder.HasOne(r => r.User)
               .WithMany(u => u.Ratings)
               .HasForeignKey(r => r.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Song)
               .WithMany(s => s.Ratings)
               .HasForeignKey(r => r.SongId)
               .OnDelete(DeleteBehavior.Cascade);

        // Check Constraint for Rating (1-5)
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_SongRatings_Rating",
            "[Rating] >= 1 AND [Rating] <= 5"));
    }
}