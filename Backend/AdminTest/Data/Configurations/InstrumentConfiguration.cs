using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using AkordishKeit.Models.Entities;

namespace AkordishKeit.Data.Configurations;

public class InstrumentConfiguration : IEntityTypeConfiguration<Instrument>
{
    public void Configure(EntityTypeBuilder<Instrument> builder)
    {
        builder.ToTable("Instruments");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Name)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.EnglishName)
               .HasMaxLength(50);

        builder.HasIndex(e => e.Name)
               .IsUnique()
               .HasDatabaseName("IX_Instruments_Name");
    }
}