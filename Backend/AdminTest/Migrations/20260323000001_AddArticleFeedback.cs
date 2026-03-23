using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddArticleFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ArticleFeedbacks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArticleId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IsPositive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArticleFeedbacks_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ArticleFeedbacks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            // Unique: logged-in user votes once per article
            migrationBuilder.CreateIndex(
                name: "IX_ArticleFeedback_Article_User",
                table: "ArticleFeedbacks",
                columns: new[] { "ArticleId", "UserId" },
                unique: true,
                filter: "[UserId] IS NOT NULL");

            // Unique: anonymous (by IP) votes once per article
            migrationBuilder.CreateIndex(
                name: "IX_ArticleFeedback_Article_IP",
                table: "ArticleFeedbacks",
                columns: new[] { "ArticleId", "IpAddress" },
                unique: true,
                filter: "[UserId] IS NULL AND [IpAddress] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArticleFeedbacks");
        }
    }
}
