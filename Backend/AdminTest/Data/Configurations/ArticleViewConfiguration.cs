using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AkordishKeit.Data.Configurations
{
    public class ArticleViewConfiguration : IEntityTypeConfiguration<ArticleView>
    {
        public void Configure(EntityTypeBuilder<ArticleView> builder)
        {
            builder.ToTable("ArticleViews");

            builder.HasKey(av => av.Id);

            builder.Property(av => av.ArticleId)
                .IsRequired();

            builder.Property(av => av.IpAddress)
                .HasMaxLength(45);

            builder.Property(av => av.UserAgent)
                .HasMaxLength(500);

            builder.Property(av => av.Referrer)
                .HasMaxLength(500);

            builder.Property(av => av.ViewedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            // Relationships
            builder.HasOne(av => av.Article)
                .WithMany()
                .HasForeignKey(av => av.ArticleId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(av => av.User)
                .WithMany()
                .HasForeignKey(av => av.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes for performance
            builder.HasIndex(av => new { av.ArticleId, av.UserId, av.ViewedAt });
            builder.HasIndex(av => new { av.ArticleId, av.IpAddress, av.UserAgent, av.ViewedAt });
        }
    }
}
