using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class ButtonClickConfiguration : IEntityTypeConfiguration<ButtonClick>
    {
        public void Configure(EntityTypeBuilder<ButtonClick> builder)
        {
            builder.ToTable("ButtonClicks");

            builder.HasKey(bc => bc.Id);

            builder.Property(bc => bc.ButtonType).HasMaxLength(50).IsRequired();
            builder.Property(bc => bc.ItemLabel).HasMaxLength(200);
            builder.Property(bc => bc.IpAddress).HasMaxLength(45);
            builder.Property(bc => bc.UserAgent).HasMaxLength(500);

            builder.Property(bc => bc.ClickedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(bc => bc.User)
                .WithMany()
                .HasForeignKey(bc => bc.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(bc => new { bc.ButtonType, bc.ItemId, bc.ClickedAt })
                .HasDatabaseName("IX_ButtonClicks_ButtonType_ItemId_ClickedAt");

            // Covers analytics dashboard queries that filter by ButtonType (or a prefix of it)
            // and a ClickedAt range without pinning ItemId.
            builder.HasIndex(bc => new { bc.ButtonType, bc.ClickedAt })
                .HasDatabaseName("IX_ButtonClicks_ButtonType_ClickedAt");
        }
    }
}
