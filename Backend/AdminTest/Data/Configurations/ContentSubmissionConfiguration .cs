using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ContentSubmissionConfiguration : IEntityTypeConfiguration<ContentSubmission>
{
    public void Configure(EntityTypeBuilder<ContentSubmission> builder)
    {
        // Table Name
        builder.ToTable("ContentSubmissions");

        // Primary Key
        builder.HasKey(cs => cs.Id);

        // Properties
        builder.Property(cs => cs.SongId)
               .IsRequired();

        builder.Property(cs => cs.Status)
               .IsRequired()
               .HasConversion<int>()
               .HasDefaultValue(SubmissionStatus.Pending);

        builder.Property(cs => cs.SubmittedByUserId)
               .IsRequired();

        builder.Property(cs => cs.SubmittedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(cs => cs.AdminNotes)
               .HasMaxLength(1000);

        builder.Property(cs => cs.RejectionReason)
               .HasMaxLength(500);

        builder.Property(cs => cs.IsDeleted)
               .IsRequired()
               .HasDefaultValue(false);

        // Indexes
        builder.HasIndex(cs => cs.Status)
               .HasDatabaseName("IX_ContentSubmissions_Status");

        builder.HasIndex(cs => cs.SubmittedByUserId)
               .HasDatabaseName("IX_ContentSubmissions_SubmittedByUserId");

        builder.HasIndex(cs => cs.SongId)
               .HasDatabaseName("IX_ContentSubmissions_SongId");

        builder.HasIndex(cs => cs.SubmittedAt)
               .HasDatabaseName("IX_ContentSubmissions_SubmittedAt");

        builder.HasIndex(cs => new { cs.Status, cs.IsDeleted })
               .HasDatabaseName("IX_ContentSubmissions_Status_IsDeleted");

        // Relationships - Song
        builder.HasOne(cs => cs.Song)
               .WithMany()
               .HasForeignKey(cs => cs.SongId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - SubmittedByUser
        builder.HasOne(cs => cs.SubmittedByUser)
               .WithMany()
               .HasForeignKey(cs => cs.SubmittedByUserId)
               .OnDelete(DeleteBehavior.Restrict);

        // Relationships - ReviewedByUser
        builder.HasOne(cs => cs.ReviewedByUser)
               .WithMany()
               .HasForeignKey(cs => cs.ReviewedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}