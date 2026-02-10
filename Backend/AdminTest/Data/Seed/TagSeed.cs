using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data.Seed;

public static class TagSeed
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        var tags = new List<Tag>
        {
            new() { Id = 1, Name = "שבת" },
            new() { Id = 2, Name = "חתונה" },
            new() { Id = 3, Name = "חגים" },
            new() { Id = 4, Name = "ראש השנה" },
            new() { Id = 5, Name = "יום כיפור" },
            new() { Id = 6, Name = "סוכות" },
            new() { Id = 7, Name = "חנוכה" },
            new() { Id = 8, Name = "פורים" },
            new() { Id = 9, Name = "פסח" },
            new() { Id = 10, Name = "ספירת העומר" },
            new() { Id = 11, Name = "שבועות" },
            new() { Id = 12, Name = "תשעה באב" },
            new() { Id = 13, Name = "אמונה" },
            new() { Id = 14, Name = "תודה" },
            new() { Id = 15, Name = "תפילה" },
            new() { Id = 16, Name = "שמחה" },
            new() { Id = 17, Name = "עצוב" },
            new() { Id = 18, Name = "מתחיל" },
            new() { Id = 19, Name = "מתקדם" },
            new() { Id = 20, Name = "קל לנגינה" }
        };

        modelBuilder.Entity<Tag>().HasData(tags);
    }
}