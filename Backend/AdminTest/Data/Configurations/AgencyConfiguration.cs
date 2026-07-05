using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AgencyConfiguration : IEntityTypeConfiguration<Agency>
{
    public void Configure(EntityTypeBuilder<Agency> builder)
    {
        builder.ToTable("Agencies");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Slug).IsRequired().HasMaxLength(220);
        builder.Property(a => a.LogoUrl).HasMaxLength(500);
        builder.Property(a => a.BannerImageUrl).HasMaxLength(500);
        builder.Property(a => a.BannerBlur).HasDefaultValue(0);
        builder.Property(a => a.ShortDescription).HasMaxLength(500);
        builder.Property(a => a.FullDescription).HasMaxLength(4000);
        builder.Property(a => a.PhoneNumber).HasMaxLength(20);
        builder.Property(a => a.WhatsAppNumber).HasMaxLength(20);
        builder.Property(a => a.Email).HasMaxLength(200);
        builder.Property(a => a.WebsiteUrl).HasMaxLength(500);
        builder.Property(a => a.BrandPrimaryColor).HasMaxLength(20);
        builder.Property(a => a.BrandSecondaryColor).HasMaxLength(20);
        builder.Property(a => a.BrandTextColor).HasMaxLength(20);
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(a => a.Slug).IsUnique().HasFilter("[IsDeleted] = 0");
        builder.HasIndex(a => new { a.IsDeleted, a.IsActive, a.ShowInIndexBanner, a.DisplayOrder });

        builder.HasMany(a => a.Profiles)
            .WithOne(p => p.Agency)
            .HasForeignKey(p => p.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Contents)
            .WithOne(c => c.Agency)
            .HasForeignKey(c => c.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class AgencyProfileConfiguration : IEntityTypeConfiguration<AgencyProfile>
{
    public void Configure(EntityTypeBuilder<AgencyProfile> builder)
    {
        builder.ToTable("AgencyProfiles");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.ProfileType).IsRequired().HasMaxLength(40);
        builder.Property(p => p.ContactMode).HasConversion<int>().HasDefaultValue(AgencyContactMode.Direct);
        builder.Property(p => p.ShowBadge).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        builder.HasIndex(p => new { p.ProfileType, p.ProfileId }).IsUnique();
        builder.HasIndex(p => new { p.AgencyId, p.ProfileType, p.ProfileId }).IsUnique();
    }
}

public class AgencyContentConfiguration : IEntityTypeConfiguration<AgencyContent>
{
    public void Configure(EntityTypeBuilder<AgencyContent> builder)
    {
        builder.ToTable("AgencyContents");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.ContentType).IsRequired().HasMaxLength(40);
        builder.Property(c => c.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        builder.HasIndex(c => new { c.AgencyId, c.ContentType, c.ContentId }).IsUnique();
    }
}
