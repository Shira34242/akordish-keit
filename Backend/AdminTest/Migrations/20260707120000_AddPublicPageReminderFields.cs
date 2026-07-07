using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    [Migration("20260707120000_AddPublicPageReminderFields")]
    public partial class AddPublicPageReminderFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastPublicPageReminderAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PendingPublicPageCategoryId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingPublicPageType",
                table: "Users",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PublicPageReminderDismissCount",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "LastPublicPageReminderAt", table: "Users");
            migrationBuilder.DropColumn(name: "PendingPublicPageCategoryId", table: "Users");
            migrationBuilder.DropColumn(name: "PendingPublicPageType", table: "Users");
            migrationBuilder.DropColumn(name: "PublicPageReminderDismissCount", table: "Users");
        }
    }
}
