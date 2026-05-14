using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260514173000_AdaptNewsPageSectionsToPageCategories")]
    public partial class AdaptNewsPageSectionsToPageCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[NewsPageSectionCategories]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [NewsPageSectionCategories] (
                        [NewsPageSectionId] int NOT NULL,
                        [CategoryId] int NOT NULL,
                        CONSTRAINT [PK_NewsPageSectionCategories] PRIMARY KEY ([NewsPageSectionId], [CategoryId]),
                        CONSTRAINT [FK_NewsPageSectionCategories_ArticleCategories_CategoryId]
                            FOREIGN KEY ([CategoryId]) REFERENCES [ArticleCategories] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_NewsPageSectionCategories_NewsPageSections_NewsPageSectionId]
                            FOREIGN KEY ([NewsPageSectionId]) REFERENCES [NewsPageSections] ([Id]) ON DELETE CASCADE
                    );
                END
            """);

            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[NewsPageSectionCategories]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NewsPageSectionCategories_CategoryId' AND object_id = OBJECT_ID(N'[NewsPageSectionCategories]'))
                    CREATE INDEX [IX_NewsPageSectionCategories_CategoryId] ON [NewsPageSectionCategories] ([CategoryId]);
            """);

            migrationBuilder.Sql("""
                UPDATE s
                SET
                    s.ContentTypeId = COALESCE(s.ContentTypeId, c.Section),
                    s.ArticleCount = 0
                FROM NewsPageSections s
                INNER JOIN ArticleCategories c ON c.Id = s.CategoryId
                WHERE s.CategoryId IS NOT NULL;
            """);

            migrationBuilder.Sql("""
                INSERT INTO NewsPageSectionCategories (NewsPageSectionId, CategoryId)
                SELECT DISTINCT s.Id, s.CategoryId
                FROM NewsPageSections s
                INNER JOIN ArticleCategories c ON c.Id = s.CategoryId
                WHERE s.CategoryId IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM NewsPageSectionCategories link
                      WHERE link.NewsPageSectionId = s.Id
                        AND link.CategoryId = s.CategoryId
                  );
            """);

            migrationBuilder.Sql("""
                UPDATE NewsPageSections
                SET ArticleCount = 0
                WHERE CategoryId IS NULL;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF OBJECT_ID(N'[NewsPageSectionCategories]', N'U') IS NOT NULL
                    DROP TABLE [NewsPageSectionCategories];
            """);
        }
    }
}
