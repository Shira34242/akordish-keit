using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

/// <summary>
/// תצורת Entity Framework עבור Subscription
/// </summary>
public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        // Table Name
        builder.ToTable("Subscriptions");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.UserId)
               .IsRequired();

        builder.Property(e => e.Plan)
               .IsRequired()
               .HasDefaultValue(SubscriptionPlan.Free);

        builder.Property(e => e.Status)
               .IsRequired()
               .HasDefaultValue(SubscriptionStatus.PendingPayment);

        builder.Property(e => e.IsTrial)
               .IsRequired()
               .HasDefaultValue(false);

        builder.Property(e => e.StartDate)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.IsAutoRenew)
               .IsRequired()
               .HasDefaultValue(true);

        builder.Property(e => e.CancellationReason)
               .HasMaxLength(500);

        builder.Property(e => e.Price)
               .HasColumnType("decimal(10,2)");

        builder.Property(e => e.Currency)
               .IsRequired()
               .HasMaxLength(3)
               .HasDefaultValue("ILS");

        builder.Property(e => e.BillingCycle)
               .HasMaxLength(50);

        builder.Property(e => e.NumberOfAdditionalProfiles)
               .IsRequired()
               .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => e.UserId)
               .HasDatabaseName("IX_Subscriptions_UserId");

        builder.HasIndex(e => e.Status)
               .HasDatabaseName("IX_Subscriptions_Status");

        builder.HasIndex(e => new { e.UserId, e.Status })
               .HasDatabaseName("IX_Subscriptions_UserId_Status");

        builder.HasIndex(e => e.EndDate)
               .HasDatabaseName("IX_Subscriptions_EndDate");

        // Relationships
        builder.HasOne(s => s.User)
               .WithMany(u => u.Subscriptions)
               .HasForeignKey(s => s.UserId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
