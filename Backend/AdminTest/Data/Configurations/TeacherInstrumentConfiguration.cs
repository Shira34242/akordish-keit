using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class TeacherInstrumentConfiguration : IEntityTypeConfiguration<TeacherInstrument>
    {
        public void Configure(EntityTypeBuilder<TeacherInstrument> builder)
        {
            // Table name
            builder.ToTable("TeacherInstruments");

            // Primary Key
            builder.HasKey(ti => ti.Id);

            // Required fields
            builder.Property(ti => ti.TeacherId)
                .IsRequired();

            builder.Property(ti => ti.InstrumentId)
                .IsRequired();

            // Default values
            builder.Property(ti => ti.IsPrimary)
                .HasDefaultValue(false);

            // Relationships

            // Teacher (Many-to-One)
            // הקשר מוגדר ב-TeacherConfiguration

            // Instrument (Many-to-One)
            builder.HasOne(ti => ti.Instrument)
                .WithMany()
                .HasForeignKey(ti => ti.InstrumentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes
            builder.HasIndex(ti => ti.TeacherId);
            builder.HasIndex(ti => ti.InstrumentId);
            builder.HasIndex(ti => ti.IsPrimary);

            // Unique constraint - כל מורה יכול ללמד כל כלי רק פעם אחת
            builder.HasIndex(ti => new { ti.TeacherId, ti.InstrumentId })
                .IsUnique();
        }
    }
}
