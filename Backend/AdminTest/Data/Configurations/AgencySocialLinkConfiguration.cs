using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AgencySocialLinkConfiguration : IEntityTypeConfiguration<AgencySocialLink>
{
    public void Configure(EntityTypeBuilder<AgencySocialLink> builder)
    {
        builder.ToTable("AgencySocialLinks");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Platform).IsRequired();
        builder.Property(e => e.Url).IsRequired().HasMaxLength(500);

        builder.HasIndex(e => e.AgencyId).HasDatabaseName("IX_AgencySocialLinks_AgencyId");

        builder.HasOne(sl => sl.Agency)
            .WithMany(a => a.SocialLinks)
            .HasForeignKey(sl => sl.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
