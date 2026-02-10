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

        // Indexes
        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_Tags_Name");
    }
}