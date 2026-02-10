using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        // Table Name
        builder.ToTable("Users");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.Username)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.Email)
               .IsRequired()
               .HasMaxLength(150);

        builder.Property(e => e.GoogleId)
               .HasMaxLength(255);

        builder.Property(e => e.PasswordHash)
               .HasMaxLength(500);

        builder.Property(e => e.ProfileImageUrl)
               .HasMaxLength(500);

        builder.Property(e => e.Phone)
               .HasMaxLength(20);

        builder.Property(e => e.Role)
               .IsRequired()
               .HasDefaultValue(UserRole.Regular);

        builder.Property(e => e.Level)
               .IsRequired()
               .HasDefaultValue(1);

        builder.Property(e => e.Points)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.IsActive)
               .IsRequired()
               .HasDefaultValue(true);

        builder.Property(e => e.EmailConfirmed)
               .IsRequired()
               .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(e => e.Email)
               .IsUnique()
               .HasDatabaseName("IX_Users_Email");

        builder.HasIndex(e => e.Username)
               .IsUnique()
               .HasDatabaseName("IX_Users_Username");

        builder.HasIndex(e => e.GoogleId)
               .IsUnique()
               .HasDatabaseName("IX_Users_GoogleId")
               .HasFilter("[GoogleId] IS NOT NULL");

        builder.HasIndex(e => e.PreferredInstrumentId)
               .HasDatabaseName("IX_Users_PreferredInstrumentId");

        // Relationships

        // PreferredInstrument
        builder.HasOne(u => u.PreferredInstrument)
               .WithMany(i => i.Users)
               .HasForeignKey(u => u.PreferredInstrumentId)
               .OnDelete(DeleteBehavior.SetNull);

        // ManagedArtist
        builder.HasOne(u => u.ManagedArtist)
               .WithOne(a => a.User)
               .HasForeignKey<Artist>(a => a.UserId)
               .OnDelete(DeleteBehavior.SetNull);

        // ServiceProviderProfiles (1:Many - משתמש יכול לנהל מספר פרופילים מקצועיים)
        builder.HasMany(u => u.ServiceProviderProfiles)
               .WithOne(sp => sp.User)
               .HasForeignKey(sp => sp.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        // Note: Subscription relationship is defined in SubscriptionConfiguration
        // User has many Subscriptions, current active subscription tracked via queries
    }
}
