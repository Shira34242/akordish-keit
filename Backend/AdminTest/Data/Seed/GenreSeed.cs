using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data.Seed;

public static class GenreSeed
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        var genres = new List<Genre>
        {
            new() { Id = 1, Name = "חסידי" },
            new() { Id = 2, Name = "ספרדי/מזרחי" },
            new() { Id = 3, Name = "פופ" },
            new() { Id = 4, Name = "רוק" },
            new() { Id = 5, Name = "איטי" },
            new() { Id = 6, Name = "שמח" },
            new() { Id = 7, Name = "קרליבך" },
            new() { Id = 8, Name = "ילדים" },
            new() { Id = 9, Name = "נשים" },
            new() { Id = 10, Name = "אנגלית" }
        };

        modelBuilder.Entity<Genre>().HasData(genres);
    }
}