using Microsoft.EntityFrameworkCore;
using AkordishKeit.Models.Entities;

namespace AkordishKeit.Data.Seed;

public static class InstrumentSeed
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        var instruments = new List<Instrument>
        {
            new() { Id = 1, Name = "גיטרה", EnglishName = "Guitar" },
            new() { Id = 2, Name = "פסנתר", EnglishName = "Piano" },
            new() { Id = 3, Name = "קלידים", EnglishName = "Keyboard" },
            new() { Id = 4, Name = "אורגן", EnglishName = "Organ" },
            new() { Id = 5, Name = "עוגב", EnglishName = "Accordion" },
            new() { Id = 6, Name = "כינור", EnglishName = "Violin" },
            new() { Id = 7, Name = "בס", EnglishName = "Bass" },
            new() { Id = 8, Name = "תופים", EnglishName = "Drums" },
            new() { Id = 9, Name = "יוקולילי", EnglishName = "Ukulele" },
            new() { Id = 10, Name = "חליל", EnglishName = "Flute" }
        };

        modelBuilder.Entity<Instrument>().HasData(instruments);
    }
}