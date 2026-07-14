using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class UserReferralConfiguration : IEntityTypeConfiguration<UserReferral>
{
    public void Configure(EntityTypeBuilder<UserReferral> builder)
    {
        builder.ToTable("UserReferrals");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.ReferralCode)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.Source)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.IpAddress)
            .HasMaxLength(64);

        builder.Property(x => x.UserAgent)
            .HasMaxLength(512);

        builder.Property(x => x.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(x => x.ReferredUserId)
            .IsUnique()
            .HasDatabaseName("IX_UserReferrals_ReferredUserId");

        builder.HasIndex(x => x.ReferrerUserId)
            .HasDatabaseName("IX_UserReferrals_ReferrerUserId");

        builder.HasIndex(x => x.ReferralCode)
            .HasDatabaseName("IX_UserReferrals_ReferralCode");

        builder.HasOne(x => x.ReferrerUser)
            .WithMany()
            .HasForeignKey(x => x.ReferrerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.ReferredUser)
            .WithMany()
            .HasForeignKey(x => x.ReferredUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
