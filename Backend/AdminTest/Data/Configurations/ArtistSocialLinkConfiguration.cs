using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArtistSocialLinkConfiguration : IEntityTypeConfiguration<ArtistSocialLink>
{
    public void Configure(EntityTypeBuilder<ArtistSocialLink> builder)
    {
        // Table Name
        builder.ToTable("ArtistSocialLinks");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Platform)
               .IsRequired();

        builder.Property(e => e.Url)
               .IsRequired()
               .HasMaxLength(500);

        // Indexes
        builder.HasIndex(e => e.ArtistId)
               .HasDatabaseName("IX_ArtistSocialLinks_ArtistId");

        // Relationships
        builder.HasOne(sl => sl.Artist)
               .WithMany(a => a.SocialLinks)
               .HasForeignKey(sl => sl.ArtistId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}