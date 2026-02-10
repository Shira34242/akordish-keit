using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class EventConfiguration : IEntityTypeConfiguration<Event>
    {
        public void Configure(EntityTypeBuilder<Event> builder)
        {
            builder.ToTable("Events");

            builder.HasKey(e => e.Id);

            builder.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(e => e.Description)
                .HasMaxLength(1000);

            builder.Property(e => e.ImageUrl)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(e => e.TicketUrl)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(e => e.EventDate)
                .IsRequired();

            builder.Property(e => e.Location)
                .HasMaxLength(200);

            builder.Property(e => e.ArtistName)
                .HasMaxLength(100);

            builder.Property(e => e.Price)
                .HasPrecision(18, 2);

            builder.Property(e => e.DisplayOrder)
                .IsRequired()
                .HasDefaultValue(0);

            builder.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            builder.Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(e => e.UpdatedAt);

            builder.Property(e => e.CreatedBy)
                .HasMaxLength(100);

            builder.Property(e => e.UpdatedBy)
                .HasMaxLength(100);

            builder.Property(e => e.IsDeleted)
                .IsRequired()
                .HasDefaultValue(false);

            // Indexes
            builder.HasIndex(e => e.IsDeleted);
            builder.HasIndex(e => e.EventDate);
            builder.HasIndex(e => new { e.IsActive, e.EventDate, e.DisplayOrder })
                .HasDatabaseName("IX_Events_Active_Date_Order");

            // Query Filter - exclude soft deleted
            builder.HasQueryFilter(e => !e.IsDeleted);
        }
    }
}
