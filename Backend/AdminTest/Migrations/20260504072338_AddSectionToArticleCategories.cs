using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddSectionToArticleCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Section",
                table: "ArticleCategories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // קטגוריות 1, 2, 6, 10, 11, 14, 15 נשארות עם Section=0 (חדשות מוזיקה) — defaultValue של העמודה
            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 3,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 4,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 5,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 7,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 8,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 9,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 12,
                column: "Section",
                value: 1);

            migrationBuilder.UpdateData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 13,
                column: "Section",
                value: 1);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Section",
                table: "ArticleCategories");
        }
    }
}
