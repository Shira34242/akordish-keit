using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        // Table Name
        builder.ToTable("Tags");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.ShowInChordQuickSearch)
               .HasDefaultValue(false);

        builder.Property(e => e.ChordQuickSearchOrder)
               .HasDefaultValue(0);

        // Indexes
        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_Tags_Name");

        builder.HasIndex(e => new { e.ShowInChordQuickSearch, e.ChordQuickSearchOrder })
               .HasDatabaseName("IX_Tags_ChordQuickSearch");
    }
}
