using AkordishKeit.Extensions;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Data.Seed;

public static class ArticleCategorySeed
{
    // Initial section assignment for the 15 historical categories.
    // Editable from the admin panel after seeding (categories page).
    private static readonly Dictionary<ArticleCategory, ArticleCategorySection> SectionMap = new()
    {
        { ArticleCategory.General,         ArticleCategorySection.News },
        { ArticleCategory.News,            ArticleCategorySection.News },
        { ArticleCategory.Reviews,         ArticleCategorySection.Content },
        { ArticleCategory.Interviews,      ArticleCategorySection.Content },
        { ArticleCategory.Features,        ArticleCategorySection.Content },
        { ArticleCategory.LiveReports,     ArticleCategorySection.News },
        { ArticleCategory.AlbumReviews,    ArticleCategorySection.Content },
        { ArticleCategory.MusicTech,       ArticleCategorySection.Content },
        { ArticleCategory.Education,       ArticleCategorySection.Content },
        { ArticleCategory.Popular,         ArticleCategorySection.News },
        { ArticleCategory.Clips,           ArticleCategorySection.News },
        { ArticleCategory.Blog,            ArticleCategorySection.Content },
        { ArticleCategory.Opinion,         ArticleCategorySection.Content },
        { ArticleCategory.Charts,          ArticleCategorySection.News },
        { ArticleCategory.BehindTheScenes, ArticleCategorySection.News }
    };

    public static void Seed(ModelBuilder modelBuilder)
    {
        var categories = Enum.GetValues<ArticleCategory>()
            .Select(c => new ArticleCategoryEntity
            {
                Id = (int)c,
                Name = c.ToString(),
                DisplayName = c.GetDisplayName(),
                Section = SectionMap.TryGetValue(c, out var section) ? section : ArticleCategorySection.News
            })
            .ToList();

        modelBuilder.Entity<ArticleCategoryEntity>().HasData(categories);
    }
}
