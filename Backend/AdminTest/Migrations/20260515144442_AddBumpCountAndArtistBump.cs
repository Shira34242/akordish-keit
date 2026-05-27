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
            migrationBuilder.Sql("IF COL_LENGTH('Songs', 'BumpCount') IS NULL ALTER TABLE [Songs] ADD [BumpCount] int NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF COL_LENGTH('Playlists', 'BumpCount') IS NULL ALTER TABLE [Playlists] ADD [BumpCount] int NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF COL_LENGTH('MusicServiceProviders', 'BumpCount') IS NULL ALTER TABLE [MusicServiceProviders] ADD [BumpCount] int NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF COL_LENGTH('Artists', 'BumpCount') IS NULL ALTER TABLE [Artists] ADD [BumpCount] int NOT NULL DEFAULT 0;");
            migrationBuilder.Sql("IF COL_LENGTH('Artists', 'BumpedAt') IS NULL ALTER TABLE [Artists] ADD [BumpedAt] datetime2 NULL;");
            migrationBuilder.Sql("IF COL_LENGTH('Articles', 'BumpCount') IS NULL ALTER TABLE [Articles] ADD [BumpCount] int NOT NULL DEFAULT 0;");
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
