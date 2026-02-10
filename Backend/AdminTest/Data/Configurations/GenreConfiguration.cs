using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class GenreConfiguration : IEntityTypeConfiguration<Genre>
{
    public void Configure(EntityTypeBuilder<Genre> builder)
    {
        // Table Name
        builder.ToTable("Genres");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(50);

        // Indexes
        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_Genres_Name");
    }
}