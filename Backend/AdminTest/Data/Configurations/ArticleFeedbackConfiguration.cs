using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ArticleFeedbackConfiguration : IEntityTypeConfiguration<ArticleFeedback>
{
    public void Configure(EntityTypeBuilder<ArticleFeedback> builder)
    {
        builder.ToTable("ArticleFeedbacks");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.IpAddress)
            .HasMaxLength(64);

        builder.Property(f => f.GuestId)
            .HasMaxLength(64);

        builder.Property(f => f.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        // משתמש מחובר: הצבעה אחת לכתבה
        builder.HasIndex(f => new { f.ArticleId, f.UserId })
            .IsUnique()
            .HasFilter("[UserId] IS NOT NULL")
            .HasDatabaseName("IX_ArticleFeedback_Article_User");

        // אנונימי: הצבעה אחת לכתבה לפי מזהה אורח בדפדפן
        builder.HasIndex(f => new { f.ArticleId, f.GuestId })
            .IsUnique()
            .HasFilter("[UserId] IS NULL AND [GuestId] IS NOT NULL")
            .HasDatabaseName("IX_ArticleFeedback_Article_Guest");

        // FK → Article
        builder.HasOne(f => f.Article)
            .WithMany()
            .HasForeignKey(f => f.ArticleId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK → User (nullable)
        builder.HasOne(f => f.User)
            .WithMany()
            .HasForeignKey(f => f.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasQueryFilter(f => !f.Article.IsDeleted);
    }
}
