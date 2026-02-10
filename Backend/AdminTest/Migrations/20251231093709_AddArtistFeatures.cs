using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddArtistFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BannerGifUrl",
                table: "Artists",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BannerImageUrl",
                table: "Artists",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayOrder",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsPremium",
                table: "Artists",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastBoostDate",
                table: "Artists",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShortBio",
                table: "Artists",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ArticleArtists",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArticleId = table.Column<int>(type: "int", nullable: false),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleArtists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArticleArtists_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ArticleArtists_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ArtistGalleryImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Caption = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtistGalleryImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtistGalleryImages_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ArtistVideos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    VideoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtistVideos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtistVideos_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventArtists",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventArtists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventArtists_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventArtists_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleArtists_ArticleId_ArtistId",
                table: "ArticleArtists",
                columns: new[] { "ArticleId", "ArtistId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ArticleArtists_ArtistId",
                table: "ArticleArtists",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_ArtistGalleryImages_ArtistId",
                table: "ArtistGalleryImages",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_ArtistVideos_ArtistId",
                table: "ArtistVideos",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_EventArtists_ArtistId",
                table: "EventArtists",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_EventArtists_EventId_ArtistId",
                table: "EventArtists",
                columns: new[] { "EventId", "ArtistId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArticleArtists");

            migrationBuilder.DropTable(
                name: "ArtistGalleryImages");

            migrationBuilder.DropTable(
                name: "ArtistVideos");

            migrationBuilder.DropTable(
                name: "EventArtists");

            migrationBuilder.DropColumn(
                name: "BannerGifUrl",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerImageUrl",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "DisplayOrder",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "IsPremium",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "LastBoostDate",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "ShortBio",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Artists");
        }
    }
}
