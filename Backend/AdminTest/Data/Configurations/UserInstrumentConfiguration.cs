using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class UserInstrumentConfiguration : IEntityTypeConfiguration<UserInstrument>
{
    public void Configure(EntityTypeBuilder<UserInstrument> builder)
    {
        builder.ToTable("UserInstruments");

        builder.HasKey(ui => ui.Id);

        builder.Property(ui => ui.UserId).IsRequired();
        builder.Property(ui => ui.InstrumentId).IsRequired();
        builder.Property(ui => ui.IsPrimary).HasDefaultValue(false);

        builder.HasOne(ui => ui.User)
               .WithMany(u => u.Instruments)
               .HasForeignKey(ui => ui.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ui => ui.Instrument)
               .WithMany()
               .HasForeignKey(ui => ui.InstrumentId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(ui => ui.UserId);
        builder.HasIndex(ui => ui.InstrumentId);

        // אותו משתמש לא יכול לבחור אותו כלי פעמיים
        builder.HasIndex(ui => new { ui.UserId, ui.InstrumentId }).IsUnique();
    }
}
