using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        // Table Name
        builder.ToTable("Clients");

        // Primary Key
        builder.HasKey(e => e.Id);

        // Properties
        builder.Property(e => e.BusinessName)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(e => e.ContactPerson)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.Email)
               .IsRequired()
               .HasMaxLength(100);

        builder.Property(e => e.Phone)
               .IsRequired()
               .HasMaxLength(20);

        builder.Property(e => e.LogoUrl)
               .HasMaxLength(500);

        builder.Property(e => e.IsActive)
               .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
               .HasDefaultValueSql("GETUTCDATE()");

        // Indexes
        builder.HasIndex(e => e.Email)
               .IsUnique()
               .HasDatabaseName("IX_Clients_Email");

        builder.HasIndex(e => e.BusinessName)
               .HasDatabaseName("IX_Clients_BusinessName");

        // Relationships
        builder.HasOne(c => c.CreatedByUser)
               .WithMany()
               .HasForeignKey(c => c.CreatedByUserId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(c => c.UpdatedByUser)
               .WithMany()
               .HasForeignKey(c => c.UpdatedByUserId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
