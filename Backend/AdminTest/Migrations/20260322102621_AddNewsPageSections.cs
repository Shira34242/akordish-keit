using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsPageSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NewsPageSections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SectionType = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    ContentTypeId = table.Column<int>(type: "int", nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    ArticleCount = table.Column<int>(type: "int", nullable: false, defaultValue: 10),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NewsPageSections", x => x.Id);
                });

            // Seed: 3 פסי ברירת מחדל — זהים להתנהגות הקודמת שהייתה מקודדת
            migrationBuilder.InsertData(
                table: "NewsPageSections",
                columns: new[] { "Title", "SectionType", "CategoryId", "ContentTypeId", "DisplayOrder", "IsActive", "ArticleCount", "CreatedAt" },
                values: new object[,]
                {
                    { "פופולאריים", 0, 10,   null, 1, true, 10, new DateTime(2026, 3, 22, 0, 0, 0, DateTimeKind.Utc) },
                    { "תוכן",       1, null,  1,   2, true, 10, new DateTime(2026, 3, 22, 0, 0, 0, DateTimeKind.Utc) },
                    { "קליפים",     0, 11,   null, 3, true, 10, new DateTime(2026, 3, 22, 0, 0, 0, DateTimeKind.Utc) }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NewsPageSections");
        }
    }
}
