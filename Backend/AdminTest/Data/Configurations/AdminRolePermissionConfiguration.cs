using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class AdminRolePermissionConfiguration : IEntityTypeConfiguration<AdminRolePermission>
{
    public void Configure(EntityTypeBuilder<AdminRolePermission> builder)
    {
        builder.ToTable("AdminRolePermissions");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.PermissionKey)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(e => new { e.AdminRoleId, e.PermissionKey })
            .IsUnique()
            .HasDatabaseName("IX_AdminRolePermissions_Role_Key");

        builder.HasOne(e => e.AdminRole)
            .WithMany(r => r.Permissions)
            .HasForeignKey(e => e.AdminRoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
