using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class NewsPageSectionConfiguration : IEntityTypeConfiguration<NewsPageSection>
    {
        public void Configure(EntityTypeBuilder<NewsPageSection> builder)
        {
            builder.ToTable("NewsPageSections");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Title)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.SectionType)
                .IsRequired()
                .HasDefaultValue(0);

            builder.Property(x => x.CategoryId)
                .IsRequired(false);

            builder.Property(x => x.ContentTypeId)
                .IsRequired(false);

            builder.Property(x => x.DisplayOrder)
                .IsRequired()
                .HasDefaultValue(0);

            builder.Property(x => x.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            builder.Property(x => x.ArticleCount)
                .IsRequired()
                .HasDefaultValue(10);

            builder.Property(x => x.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(x => x.UpdatedAt)
                .IsRequired(false);
        }
    }
}
