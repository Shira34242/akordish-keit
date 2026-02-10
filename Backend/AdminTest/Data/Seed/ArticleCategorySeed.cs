using AkordishKeit.Extensions;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data.Seed;

public static class ArticleCategorySeed
{
    public static void Seed(ModelBuilder modelBuilder)
    {
        var categories = Enum.GetValues<ArticleCategory>()
            .Select(c => new ArticleCategoryEntity
            {
                Id = (int)c,
                Name = c.ToString(),
                DisplayName = c.GetDisplayName()
            })
            .ToList();

        modelBuilder.Entity<ArticleCategoryEntity>().HasData(categories);
    }
}
