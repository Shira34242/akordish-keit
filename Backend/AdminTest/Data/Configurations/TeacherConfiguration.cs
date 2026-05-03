using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class TeacherConfiguration : IEntityTypeConfiguration<Teacher>
    {
        public void Configure(EntityTypeBuilder<Teacher> builder)
        {
            // Table name
            builder.ToTable("Teachers");

            // Primary Key (זהה ל-ServiceProvider.Id)
            builder.HasKey(t => t.Id);

            // Optional fields with max length
            builder.Property(t => t.PriceList)
                .HasMaxLength(1000);

            builder.Property(t => t.Languages)
                .HasMaxLength(500);

            builder.Property(t => t.TargetAudience)
                .HasMaxLength(500);

            builder.Property(t => t.Availability)
                .HasMaxLength(1000);

            builder.Property(t => t.Education)
                .HasMaxLength(1000);

            builder.Property(t => t.LessonTypes)
                .HasMaxLength(500);

            builder.Property(t => t.Specializations)
                .HasMaxLength(1000);

            // Relationships

            // ServiceProvider (One-to-One)
            // הקשר מוגדר ב-ServiceProviderConfiguration

            // Instruments (One-to-Many)
            builder.HasMany(t => t.Instruments)
                .WithOne(ti => ti.Teacher)
                .HasForeignKey(ti => ti.TeacherId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(t => t.Testimonials)
                .WithOne(tt => tt.Teacher)
                .HasForeignKey(tt => tt.TeacherId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes for public teacher filters
            builder.HasIndex(t => t.TargetAudience);
            builder.HasIndex(t => t.Languages);
        }
    }
}
