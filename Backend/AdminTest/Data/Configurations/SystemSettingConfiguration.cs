using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Key)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(s => s.Key)
            .IsUnique();

        builder.Property(s => s.Value)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(s => s.Description)
            .HasMaxLength(500);

        // ════════════════════════════════════
        //   נתוני ברירת מחדל
        // ════════════════════════════════════
        builder.HasData(
            new SystemSetting
            {
                Id          = 1,
                Key         = "regular_user_subscriptions_enabled",
                Value       = "false",
                Description = "הפעלת מנויים למשתמשים רגילים (BASIC/PLUS+/PRO). כאשר כבוי — אין הגבלות על משתמשים רגילים.",
                UpdatedAt   = new DateTime(2026, 3, 31, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
