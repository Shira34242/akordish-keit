using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class MusicServiceProviderConfiguration : IEntityTypeConfiguration<MusicServiceProvider>
    {
        public void Configure(EntityTypeBuilder<MusicServiceProvider> builder)
        {
            // Table name
            builder.ToTable("MusicServiceProviders");

            // Primary Key
            builder.HasKey(sp => sp.Id);

            // Required fields
            builder.Property(sp => sp.DisplayName)
                .IsRequired()
                .HasMaxLength(200);

            // Optional fields with max length
            builder.Property(sp => sp.ProfileImageUrl)
                .HasMaxLength(500);

            builder.Property(sp => sp.ShortBio)
                .HasMaxLength(500);

            builder.Property(sp => sp.FullDescription)
                .HasMaxLength(5000);

            builder.Property(sp => sp.Location)
                .HasMaxLength(200);

            builder.Property(sp => sp.WorkingHours)
                .HasMaxLength(500);

            builder.Property(sp => sp.WhatsAppNumber)
                .HasMaxLength(20);

            builder.Property(sp => sp.PhoneNumber)
                .HasMaxLength(20);

            builder.Property(sp => sp.Email)
                .HasMaxLength(200);

            builder.Property(sp => sp.WebsiteUrl)
                .HasMaxLength(500);

            builder.Property(sp => sp.VideoUrl)
                .HasMaxLength(500);

            // Enum
            builder.Property(sp => sp.Status)
                .HasConversion<int>()
                .IsRequired();

            // Subscription-related properties
            builder.Property(sp => sp.Tier)
                .IsRequired()
                .HasDefaultValue(ProfileTier.Free);

            builder.Property(sp => sp.IsPrimaryProfile)
                .HasDefaultValue(false);

            // Default values
            builder.Property(sp => sp.IsTeacher)
                .HasDefaultValue(false);

            builder.Property(sp => sp.IsFeatured)
                .HasDefaultValue(false);

            builder.Property(sp => sp.IsDeleted)
                .HasDefaultValue(false);

            builder.Property(sp => sp.CreatedAt)
                .HasDefaultValueSql("GETDATE()");

            // Relationships

            // User (1:Many - משתמש יכול לנהל מספר פרופילים מקצועיים)
            builder.HasOne(sp => sp.User)
                .WithMany(u => u.ServiceProviderProfiles)
                .HasForeignKey(sp => sp.UserId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);

            // Teacher (One-to-Zero-or-One)
            builder.HasOne(sp => sp.TeacherProfile)
                .WithOne(t => t.ServiceProvider)
                .HasForeignKey<Teacher>(t => t.Id)
                .OnDelete(DeleteBehavior.Cascade);

            // Categories (One-to-Many)
            builder.HasMany(sp => sp.Categories)
                .WithOne(c => c.ServiceProvider)
                .HasForeignKey(c => c.ServiceProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            // GalleryImages (One-to-Many)
            builder.HasMany(sp => sp.GalleryImages)
                .WithOne(g => g.ServiceProvider)
                .HasForeignKey(g => g.ServiceProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Subscription (Many-to-One)
            builder.HasOne(sp => sp.Subscription)
                .WithMany(s => s.CoveredServiceProviders)
                .HasForeignKey(sp => sp.SubscriptionId)
                .OnDelete(DeleteBehavior.NoAction);

            // Boosts (One-to-Many)
            builder.HasMany(sp => sp.Boosts)
                .WithOne(b => b.ServiceProvider)
                .HasForeignKey(b => b.ServiceProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            // UserId - לא ייחודי כי משתמש יכול לנהל מספר פרופילים
            builder.HasIndex(sp => sp.UserId)
                .HasDatabaseName("IX_ServiceProviders_UserId");

            builder.HasIndex(sp => sp.IsTeacher);
            builder.HasIndex(sp => sp.Status);
            builder.HasIndex(sp => sp.IsFeatured);
            builder.HasIndex(sp => sp.IsDeleted);
        }
    }
}
