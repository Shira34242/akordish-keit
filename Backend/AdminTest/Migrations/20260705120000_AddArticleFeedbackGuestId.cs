using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    [Migration("20260705120000_AddArticleFeedbackGuestId")]
    public partial class AddArticleFeedbackGuestId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ArticleFeedback_Article_IP",
                table: "ArticleFeedbacks");

            migrationBuilder.AddColumn<string>(
                name: "GuestId",
                table: "ArticleFeedbacks",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ArticleFeedback_Article_Guest",
                table: "ArticleFeedbacks",
                columns: new[] { "ArticleId", "GuestId" },
                unique: true,
                filter: "[UserId] IS NULL AND [GuestId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ArticleFeedback_Article_Guest",
                table: "ArticleFeedbacks");

            migrationBuilder.DropColumn(
                name: "GuestId",
                table: "ArticleFeedbacks");

            migrationBuilder.CreateIndex(
                name: "IX_ArticleFeedback_Article_IP",
                table: "ArticleFeedbacks",
                columns: new[] { "ArticleId", "IpAddress" },
                unique: true,
                filter: "[UserId] IS NULL AND [IpAddress] IS NOT NULL");
        }
    }
}
