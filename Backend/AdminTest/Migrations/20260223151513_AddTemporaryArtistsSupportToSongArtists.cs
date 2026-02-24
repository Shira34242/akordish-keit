using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddTemporaryArtistsSupportToSongArtists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SongArtists_SongId_ArtistId",
                table: "SongArtists");

            migrationBuilder.AlterColumn<int>(
                name: "ArtistId",
                table: "SongArtists",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<bool>(
                name: "IsTemporary",
                table: "SongArtists",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TempArtistName",
                table: "SongArtists",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SongArtists_IsTemporary",
                table: "SongArtists",
                column: "IsTemporary");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SongArtists_IsTemporary",
                table: "SongArtists");

            migrationBuilder.DropColumn(
                name: "IsTemporary",
                table: "SongArtists");

            migrationBuilder.DropColumn(
                name: "TempArtistName",
                table: "SongArtists");

            migrationBuilder.AlterColumn<int>(
                name: "ArtistId",
                table: "SongArtists",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SongArtists_SongId_ArtistId",
                table: "SongArtists",
                columns: new[] { "SongId", "ArtistId" },
                unique: true);
        }
    }
}
