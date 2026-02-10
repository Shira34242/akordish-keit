using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class ConvertArticleCategoryToEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Articles_ArticleCategories_CategoryId",
                table: "Articles");

            migrationBuilder.DropTable(
                name: "ArticleCategories");

            migrationBuilder.RenameColumn(
                name: "CategoryId",
                table: "Articles",
                newName: "Category");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Category",
                table: "Articles",
                newName: "CategoryId");

            migrationBuilder.CreateTable(
                name: "ArticleCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleCategories", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 0, "חדשות" },
                    { 1, "סינגלים" },
                    { 2, "ראיונות" },
                    { 3, "ביקורות" },
                    { 4, "כללי" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleCategories_Name",
                table: "ArticleCategories",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Articles_ArticleCategories_CategoryId",
                table: "Articles",
                column: "CategoryId",
                principalTable: "ArticleCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
