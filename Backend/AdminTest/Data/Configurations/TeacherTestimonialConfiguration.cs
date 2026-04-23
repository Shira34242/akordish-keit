using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class TeacherTestimonialConfiguration : IEntityTypeConfiguration<TeacherTestimonial>
    {
        public void Configure(EntityTypeBuilder<TeacherTestimonial> builder)
        {
            builder.ToTable("TeacherTestimonials");

            builder.HasKey(t => t.Id);

            builder.Property(t => t.StudentName)
                .HasMaxLength(120);

            builder.Property(t => t.Text)
                .IsRequired()
                .HasMaxLength(1000);

            builder.HasOne(t => t.Teacher)
                .WithMany(t => t.Testimonials)
                .HasForeignKey(t => t.TeacherId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
