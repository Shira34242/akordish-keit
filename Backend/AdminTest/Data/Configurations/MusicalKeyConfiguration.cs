using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class MusicalKeyConfiguration : IEntityTypeConfiguration<MusicalKey>
{
    public void Configure(EntityTypeBuilder<MusicalKey> builder)
    {
        // Table Name
        builder.ToTable("MusicalKeys");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(10);

        builder.Property(e => e.DisplayName)
               .IsRequired()
               .HasMaxLength(20);

        builder.Property(e => e.IsMinor)
               .IsRequired();

        builder.Property(e => e.SemitoneOffset)
               .IsRequired();

        // Indexes
        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_MusicalKeys_Name");
    }
}