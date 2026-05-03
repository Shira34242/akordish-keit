using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaylistPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Playlists_IsPublic_CreatedAt",
                table: "Playlists",
                columns: new[] { "IsPublic", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Playlists_UserId_IsPublic",
                table: "Playlists",
                columns: new[] { "UserId", "IsPublic" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Playlists_IsPublic_CreatedAt",
                table: "Playlists");

            migrationBuilder.DropIndex(
                name: "IX_Playlists_UserId_IsPublic",
                table: "Playlists");
        }
    }
}
