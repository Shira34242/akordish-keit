using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class AdBlockCheckConfiguration : IEntityTypeConfiguration<AdBlockCheck>
    {
        public void Configure(EntityTypeBuilder<AdBlockCheck> builder)
        {
            builder.ToTable("AdBlockChecks");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.PagePath).HasMaxLength(300);
            builder.Property(x => x.DeviceType).HasMaxLength(30);
            builder.Property(x => x.IpAddress).HasMaxLength(45);
            builder.Property(x => x.UserAgent).HasMaxLength(500);

            builder.Property(x => x.CheckedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(x => new { x.CheckedAt, x.Detected })
                .HasDatabaseName("IX_AdBlockChecks_CheckedAt_Detected");

            builder.HasIndex(x => new { x.PagePath, x.CheckedAt })
                .HasDatabaseName("IX_AdBlockChecks_PagePath_CheckedAt");
        }
    }
}
