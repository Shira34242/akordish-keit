using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class MusicServiceProviderSocialLinkConfiguration : IEntityTypeConfiguration<MusicServiceProviderSocialLink>
{
    public void Configure(EntityTypeBuilder<MusicServiceProviderSocialLink> builder)
    {
        builder.ToTable("MusicServiceProviderSocialLinks");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Platform)
            .IsRequired();

        builder.Property(e => e.Url)
            .IsRequired()
            .HasMaxLength(500);

        builder.HasIndex(e => e.ServiceProviderId)
            .HasDatabaseName("IX_MusicServiceProviderSocialLinks_ServiceProviderId");

        builder.HasOne(sl => sl.ServiceProvider)
            .WithMany(sp => sp.SocialLinks)
            .HasForeignKey(sl => sl.ServiceProviderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
