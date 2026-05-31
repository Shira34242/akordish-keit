using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddAdBlockChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdBlockChecks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Detected = table.Column<bool>(type: "bit", nullable: false),
                    PagePath = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    DeviceType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CheckedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdBlockChecks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdBlockChecks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdBlockChecks_CheckedAt_Detected",
                table: "AdBlockChecks",
                columns: new[] { "CheckedAt", "Detected" });

            migrationBuilder.CreateIndex(
                name: "IX_AdBlockChecks_PagePath_CheckedAt",
                table: "AdBlockChecks",
                columns: new[] { "PagePath", "CheckedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdBlockChecks_UserId",
                table: "AdBlockChecks",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdBlockChecks");
        }
    }
}
