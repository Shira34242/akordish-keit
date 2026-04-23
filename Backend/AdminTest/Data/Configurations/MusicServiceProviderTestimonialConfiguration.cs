using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderTestimonialConfiguration : IEntityTypeConfiguration<MusicServiceProviderTestimonial>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProviderTestimonial> builder)
        {
            builder.ToTable("MusicServiceProviderTestimonials");

            builder.HasKey(t => t.Id);

            builder.Property(t => t.ClientName)
                .HasMaxLength(120);

            builder.Property(t => t.Text)
                .IsRequired()
                .HasMaxLength(1000);

            builder.HasOne(t => t.ServiceProvider)
                .WithMany(sp => sp.CustomerTestimonials)
                .HasForeignKey(t => t.ServiceProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(t => new { t.ServiceProviderId, t.Order })
                .HasDatabaseName("IX_MusicServiceProviderTestimonials_ServiceProviderId_Order");
        }
    }
}
