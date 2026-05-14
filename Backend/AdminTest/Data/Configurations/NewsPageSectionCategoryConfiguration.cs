using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class NewsPageSectionCategoryConfiguration : IEntityTypeConfiguration<NewsPageSectionCategory>
    {
        public void Configure(EntityTypeBuilder<NewsPageSectionCategory> builder)
        {
            builder.ToTable("NewsPageSectionCategories");

            builder.HasKey(x => new { x.NewsPageSectionId, x.CategoryId });

            builder.HasOne(x => x.NewsPageSection)
                .WithMany(x => x.Categories)
                .HasForeignKey(x => x.NewsPageSectionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Category)
                .WithMany()
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.CategoryId)
                .HasDatabaseName("IX_NewsPageSectionCategories_CategoryId");
        }
    }
}
