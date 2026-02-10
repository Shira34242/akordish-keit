using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ContentReportConfiguration : IEntityTypeConfiguration<ContentReport>
{
    public void Configure(EntityTypeBuilder<ContentReport> builder)
    {
        builder.ToTable("ContentReports");

        builder.HasKey(cr => cr.Id);

        // Properties
        builder.Property(cr => cr.ContentType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(cr => cr.ReportType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(cr => cr.Description)
            .IsRequired()
            .HasMaxLength(1000);

        builder.Property(cr => cr.Status)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("Pending");

        builder.Property(cr => cr.ReportedAt)
            .IsRequired();

        builder.Property(cr => cr.AdminNotes)
            .HasMaxLength(500);

        // Indexes for performance
        // חיפוש מהיר לפי תוכן ספציפי
        builder.HasIndex(cr => new { cr.ContentType, cr.ContentId })
            .HasDatabaseName("IX_ContentReports_ContentType_ContentId");

        // פילטור מהיר לפי סטטוס
        builder.HasIndex(cr => cr.Status)
            .HasDatabaseName("IX_ContentReports_Status");

        // מיון לפי תאריך
        builder.HasIndex(cr => cr.ReportedAt)
            .HasDatabaseName("IX_ContentReports_ReportedAt");

        // Foreign Keys
        // User שדיווח (nullable - תמיכה באורחים)
        builder.HasOne(cr => cr.User)
            .WithMany()
            .HasForeignKey(cr => cr.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        // User שטיפל (nullable)
        builder.HasOne(cr => cr.ResolvedByUser)
            .WithMany()
            .HasForeignKey(cr => cr.ResolvedByUserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
