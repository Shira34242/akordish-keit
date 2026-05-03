using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class OptimizeHomePageIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Songs_Popular",
                table: "Songs",
                columns: new[] { "IsApproved", "IsDeleted", "ViewCount" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_Status_ContentType_PublishDate",
                table: "Articles",
                columns: new[] { "Status", "ContentType", "PublishDate" },
                descending: new[] { false, false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Songs_Popular",
                table: "Songs");

            migrationBuilder.DropIndex(
                name: "IX_Articles_Status_ContentType_PublishDate",
                table: "Articles");
        }
    }
}
