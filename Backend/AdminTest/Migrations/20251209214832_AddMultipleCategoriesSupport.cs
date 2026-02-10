using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddMultipleCategoriesSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Articles_Category_Status_PublishDate",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Articles");

            migrationBuilder.CreateTable(
                name: "ArticleCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ArticleArticleCategories",
                columns: table => new
                {
                    ArticleId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleArticleCategories", x => new { x.ArticleId, x.CategoryId });
                    table.ForeignKey(
                        name: "FK_ArticleArticleCategories_ArticleCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ArticleCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ArticleArticleCategories_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name" },
                values: new object[,]
                {
                    { 1, "כללי", "General" },
                    { 2, "חדשות", "News" },
                    { 3, "ביקורות", "Reviews" },
                    { 4, "ראיונות", "Interviews" },
                    { 5, "כתבות מיוחדות", "Features" },
                    { 6, "כתבות הופעות", "LiveReports" },
                    { 7, "ביקורות אלבומים", "AlbumReviews" },
                    { 8, "טכנולוגיה מוזיקלית", "MusicTech" },
                    { 9, "לימוד וחינוך", "Education" },
                    { 10, "פופולארי", "Popular" },
                    { 11, "קליפים", "Clips" },
                    { 12, "בלוג", "Blog" },
                    { 13, "דעה", "Opinion" },
                    { 14, "מצעדים", "Charts" },
                    { 15, "מאחורי הקלעים", "BehindTheScenes" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleArticleCategories_ArticleId",
                table: "ArticleArticleCategories",
                column: "ArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_ArticleArticleCategories_CategoryId",
                table: "ArticleArticleCategories",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ArticleCategories_Name",
                table: "ArticleCategories",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArticleArticleCategories");

            migrationBuilder.DropTable(
                name: "ArticleCategories");

            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Articles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Articles_Category_Status_PublishDate",
                table: "Articles",
                columns: new[] { "Category", "Status", "PublishDate" },
                descending: new[] { false, false, true });
        }
    }
}
