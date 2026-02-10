using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> builder)
    {
        // Table Name
        builder.ToTable("People");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.EnglishName)
               .HasMaxLength(100);

        builder.Property(e => e.Biography)
               .HasMaxLength(1000);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(e => e.Name)
               .HasDatabaseName("IX_People_Name");

        // Relationships handled in Song and Artist configurations
    }
}