using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderBranchConfiguration : IEntityTypeConfiguration<MusicServiceProviderBranch>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProviderBranch> builder)
        {
            builder.ToTable("MusicServiceProviderBranches");

            builder.HasKey(b => b.Id);

            builder.Property(b => b.ServiceProviderId)
                .IsRequired();

            builder.Property(b => b.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(b => b.Address)
                .HasMaxLength(300);

            builder.Property(b => b.PhoneNumber)
                .HasMaxLength(20);

            builder.Property(b => b.Email)
                .HasMaxLength(200);

            builder.Property(b => b.OpeningHours)
                .HasMaxLength(500);

            builder.Property(b => b.Order)
                .HasDefaultValue(0);

            builder.Property(b => b.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

            builder.HasOne(b => b.ServiceProvider)
                .WithMany(sp => sp.Branches)
                .HasForeignKey(b => b.ServiceProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(b => b.ServiceProviderId);
            builder.HasIndex(b => b.Order);
        }
    }
}
