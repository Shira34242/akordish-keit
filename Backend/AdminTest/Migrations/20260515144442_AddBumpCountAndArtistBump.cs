using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddBumpCountAndArtistBump : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BumpCount",
                table: "Songs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BumpCount",
                table: "Playlists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BumpCount",
                table: "MusicServiceProviders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BumpCount",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "BumpedAt",
                table: "Artists",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BumpCount",
                table: "Articles",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BumpCount",
                table: "Songs");

            migrationBuilder.DropColumn(
                name: "BumpCount",
                table: "Playlists");

            migrationBuilder.DropColumn(
                name: "BumpCount",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "BumpCount",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BumpedAt",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BumpCount",
                table: "Articles");
        }
    }
}
