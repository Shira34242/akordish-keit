using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddLikedContentReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Reaction",
                table: "LikedContents",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LikedContent_Content_Reaction",
                table: "LikedContents",
                columns: new[] { "ContentType", "ContentId", "Reaction" },
                filter: "[Reaction] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LikedContent_Content_Reaction",
                table: "LikedContents");

            migrationBuilder.DropColumn(
                name: "Reaction",
                table: "LikedContents");
        }
    }
}
