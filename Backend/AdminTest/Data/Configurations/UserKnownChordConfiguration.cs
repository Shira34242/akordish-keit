using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations;

public class UserKnownChordConfiguration : IEntityTypeConfiguration<UserKnownChord>
{
    public void Configure(EntityTypeBuilder<UserKnownChord> builder)
    {
        builder.ToTable("UserKnownChords");

        builder.HasKey(kc => kc.Id);

        builder.Property(kc => kc.Instrument)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(kc => kc.ChordName)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(kc => kc.NormalizedChordName)
            .IsRequired()
            .HasMaxLength(80);

        builder.Property(kc => kc.AddedAt)
            .IsRequired();

        builder.HasIndex(kc => new { kc.UserId, kc.Instrument, kc.NormalizedChordName })
            .IsUnique()
            .HasDatabaseName("IX_UserKnownChords_User_Instrument_Chord");

        builder.HasIndex(kc => new { kc.UserId, kc.Instrument, kc.AddedAt })
            .HasDatabaseName("IX_UserKnownChords_User_Instrument_AddedAt");

        builder.HasOne(kc => kc.User)
            .WithMany()
            .HasForeignKey(kc => kc.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
