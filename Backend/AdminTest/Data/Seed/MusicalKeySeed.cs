using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data.Seed;

public static class MusicalKeySeed
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        var keys = new List<MusicalKey>
        {
            // Major Keys
            new() { Id = 1, Name = "C", DisplayName = "דו", IsMinor = false, SemitoneOffset = 0 },
            new() { Id = 2, Name = "C#", DisplayName = "דו דיאז", IsMinor = false, SemitoneOffset = 1 },
            new() { Id = 3, Name = "D", DisplayName = "רה", IsMinor = false, SemitoneOffset = 2 },
            new() { Id = 4, Name = "D#", DisplayName = "רה דיאז", IsMinor = false, SemitoneOffset = 3 },
            new() { Id = 5, Name = "E", DisplayName = "מי", IsMinor = false, SemitoneOffset = 4 },
            new() { Id = 6, Name = "F", DisplayName = "פה", IsMinor = false, SemitoneOffset = 5 },
            new() { Id = 7, Name = "F#", DisplayName = "פה דיאז", IsMinor = false, SemitoneOffset = 6 },
            new() { Id = 8, Name = "G", DisplayName = "סול", IsMinor = false, SemitoneOffset = 7 },
            new() { Id = 9, Name = "G#", DisplayName = "סול דיאז", IsMinor = false, SemitoneOffset = 8 },
            new() { Id = 10, Name = "A", DisplayName = "לה", IsMinor = false, SemitoneOffset = 9 },
            new() { Id = 11, Name = "A#", DisplayName = "לה דיאז", IsMinor = false, SemitoneOffset = 10 },
            new() { Id = 12, Name = "B", DisplayName = "סי", IsMinor = false, SemitoneOffset = 11 },
            
            // Minor Keys
            new() { Id = 13, Name = "Am", DisplayName = "לה מינור", IsMinor = true, SemitoneOffset = 9 },
            new() { Id = 14, Name = "A#m", DisplayName = "לה דיאז מינור", IsMinor = true, SemitoneOffset = 10 },
            new() { Id = 15, Name = "Bm", DisplayName = "סי מינור", IsMinor = true, SemitoneOffset = 11 },
            new() { Id = 16, Name = "Cm", DisplayName = "דו מינור", IsMinor = true, SemitoneOffset = 0 },
            new() { Id = 17, Name = "C#m", DisplayName = "דו דיאז מינור", IsMinor = true, SemitoneOffset = 1 },
            new() { Id = 18, Name = "Dm", DisplayName = "רה מינור", IsMinor = true, SemitoneOffset = 2 },
            new() { Id = 19, Name = "D#m", DisplayName = "רה דיאז מינור", IsMinor = true, SemitoneOffset = 3 },
            new() { Id = 20, Name = "Em", DisplayName = "מי מינור", IsMinor = true, SemitoneOffset = 4 },
            new() { Id = 21, Name = "Fm", DisplayName = "פה מינור", IsMinor = true, SemitoneOffset = 5 },
            new() { Id = 22, Name = "F#m", DisplayName = "פה דיאז מינור", IsMinor = true, SemitoneOffset = 6 },
            new() { Id = 23, Name = "Gm", DisplayName = "סול מינור", IsMinor = true, SemitoneOffset = 7 },
            new() { Id = 24, Name = "G#m", DisplayName = "סול דיאז מינור", IsMinor = true, SemitoneOffset = 8 }
        };

        modelBuilder.Entity<MusicalKey>().HasData(keys);
    }
}