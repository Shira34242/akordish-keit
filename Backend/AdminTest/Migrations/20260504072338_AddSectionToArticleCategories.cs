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
            migrationBuilder.AddColumn<string>(
                name: "BannerImageUrl",
                table: "Events",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BannerBlur",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "BannerMediaType",
                table: "Artists",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PerformanceEventId",
                table: "Artists",
                type: "int",
                nullable: true);

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

            migrationBuilder.CreateIndex(
                name: "IX_Artists_PerformanceEventId",
                table: "Artists",
                column: "PerformanceEventId");

            migrationBuilder.AddForeignKey(
                name: "FK_Artists_Events_PerformanceEventId",
                table: "Artists",
                column: "PerformanceEventId",
                principalTable: "Events",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Artists_Events_PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropIndex(
                name: "IX_Artists_PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerImageUrl",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "BannerBlur",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerMediaType",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "Section",
                table: "ArticleCategories");
        }
    }
}
