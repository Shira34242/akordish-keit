using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class EventArtistConfiguration : IEntityTypeConfiguration<EventArtist>
{
    public void Configure(EntityTypeBuilder<EventArtist> builder)
    {
        // Table Name
        builder.ToTable("EventArtists");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => new { e.EventId, e.ArtistId })
               .IsUnique()
               .HasDatabaseName("IX_EventArtists_EventId_ArtistId");

        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_EventArtists_ArtistId");

        // Relationships
        builder.HasOne(ea => ea.Event)
               .WithMany(e => e.EventArtists)
               .HasForeignKey(ea => ea.EventId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ea => ea.Artist)
               .WithMany(a => a.EventArtists)
               .HasForeignKey(ea => ea.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
