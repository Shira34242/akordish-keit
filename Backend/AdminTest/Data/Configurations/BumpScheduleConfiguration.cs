using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class BumpScheduleConfiguration : IEntityTypeConfiguration<BumpSchedule>
{
    public void Configure(EntityTypeBuilder<BumpSchedule> builder)
    {
        builder.ToTable("BumpSchedules");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.EntityType)
               .IsRequired()
               .HasMaxLength(50);

        builder.Property(e => e.EntityId)
               .IsRequired();

        builder.Property(e => e.TotalTimes)
               .IsRequired();

        builder.Property(e => e.RemainingTimes)
               .IsRequired();

        builder.Property(e => e.IntervalHours)
               .IsRequired();

        builder.Property(e => e.NextBumpAt)
               .IsRequired();

        builder.Property(e => e.CreatedAt)
               .IsRequired()
               .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => new { e.EntityType, e.EntityId })
               .HasDatabaseName("IX_BumpSchedules_EntityType_EntityId");

        builder.HasIndex(e => e.NextBumpAt)
               .HasDatabaseName("IX_BumpSchedules_NextBumpAt");
    }
}
