using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class UserReferralCodeConfiguration : IEntityTypeConfiguration<UserReferralCode>
{
    public void Configure(EntityTypeBuilder<UserReferralCode> builder)
    {
        builder.ToTable("UserReferralCodes");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(x => x.UserId)
            .IsUnique()
            .HasDatabaseName("IX_UserReferralCodes_UserId");

        builder.HasIndex(x => x.Code)
            .IsUnique()
            .HasDatabaseName("IX_UserReferralCodes_Code");

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
