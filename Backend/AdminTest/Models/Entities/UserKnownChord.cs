using System;

namespace AkordishKeit.Models.Entities;

public class UserKnownChord
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Instrument { get; set; } = string.Empty;
    public string ChordName { get; set; } = string.Empty;
    public string NormalizedChordName { get; set; } = string.Empty;
    public DateTime AddedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
