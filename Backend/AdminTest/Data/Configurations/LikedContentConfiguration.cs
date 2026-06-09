using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class LikedContentConfiguration : IEntityTypeConfiguration<LikedContent>
{
    public void Configure(EntityTypeBuilder<LikedContent> builder)
    {
        builder.ToTable("LikedContents");

        builder.HasKey(lc => lc.Id);

        builder.Property(lc => lc.ContentType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(lc => lc.LikedAt)
            .IsRequired();

        builder.Property(lc => lc.Reaction)
            .HasMaxLength(32);

        // Unique index - משתמש לא יכול לסמן אותו תוכן פעמיים
        builder.HasIndex(lc => new { lc.UserId, lc.ContentType, lc.ContentId })
            .IsUnique()
            .HasDatabaseName("IX_LikedContent_User_ContentType_ContentId");

        // Index לשאילתות מהירות
        builder.HasIndex(lc => new { lc.UserId, lc.LikedAt })
            .HasDatabaseName("IX_LikedContent_User_LikedAt");

        builder.HasIndex(lc => new { lc.ContentType, lc.ContentId, lc.Reaction })
            .HasFilter("[Reaction] IS NOT NULL")
            .HasDatabaseName("IX_LikedContent_Content_Reaction");

        // Foreign Key ל-User
        builder.HasOne(lc => lc.User)
            .WithMany()
            .HasForeignKey(lc => lc.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
