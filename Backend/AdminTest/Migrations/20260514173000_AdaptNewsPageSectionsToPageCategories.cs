using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AdaptNewsPageSectionsToPageCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryIdsCsv",
                table: "NewsPageSections",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE s
                SET
                    s.CategoryIdsCsv = CAST(s.CategoryId AS nvarchar(20)),
                    s.ContentTypeId = COALESCE(s.ContentTypeId, c.Section),
                    s.ArticleCount = 0
                FROM NewsPageSections s
                INNER JOIN ArticleCategories c ON c.Id = s.CategoryId
                WHERE s.CategoryId IS NOT NULL;
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
            migrationBuilder.DropColumn(
                name: "CategoryIdsCsv",
                table: "NewsPageSections");
        }
    }
}
