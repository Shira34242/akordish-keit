using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class BaseTablesSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Admins");

            migrationBuilder.CreateTable(
                name: "Genres",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Genres", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Instruments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EnglishName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Instruments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MusicalKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsMinor = table.Column<bool>(type: "bit", nullable: false),
                    SemitoneOffset = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MusicalKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "People",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EnglishName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Biography = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_People", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    GoogleId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ProfileImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Role = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Level = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    Points = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    PreferredInstrumentId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Instruments_PreferredInstrumentId",
                        column: x => x.PreferredInstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Artists",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EnglishName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Biography = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    WebsiteUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsVerified = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    PersonId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Artists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Artists_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Artists_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Songs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ComposerId = table.Column<int>(type: "int", nullable: false),
                    LyricistId = table.Column<int>(type: "int", nullable: true),
                    ArrangerId = table.Column<int>(type: "int", nullable: true),
                    YouTubeUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    SpotifyUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsApproved = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    LyricsWithChords = table.Column<string>(type: "nvarchar(MAX)", nullable: false),
                    OriginalKeyId = table.Column<int>(type: "int", nullable: false),
                    EasyKeyId = table.Column<int>(type: "int", nullable: true),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ViewCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    PlayCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Language = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Songs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Songs_MusicalKeys_EasyKeyId",
                        column: x => x.EasyKeyId,
                        principalTable: "MusicalKeys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_MusicalKeys_OriginalKeyId",
                        column: x => x.OriginalKeyId,
                        principalTable: "MusicalKeys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_People_ArrangerId",
                        column: x => x.ArrangerId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_People_ComposerId",
                        column: x => x.ComposerId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_People_LyricistId",
                        column: x => x.LyricistId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Songs_Users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ArtistSocialLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    Platform = table.Column<int>(type: "int", nullable: false),
                    Url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtistSocialLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtistSocialLinks_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ContentSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SongId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    SubmittedByUserId = table.Column<int>(type: "int", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    ReviewedByUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AdminNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentSubmissions_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ContentSubmissions_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ContentSubmissions_Users_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Favorites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    SongId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Favorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Favorites_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Favorites_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SongArtists",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SongId = table.Column<int>(type: "int", nullable: false),
                    ArtistId = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongArtists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SongArtists_Artists_ArtistId",
                        column: x => x.ArtistId,
                        principalTable: "Artists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SongArtists_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SongGenres",
                columns: table => new
                {
                    SongId = table.Column<int>(type: "int", nullable: false),
                    GenreId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongGenres", x => new { x.SongId, x.GenreId });
                    table.ForeignKey(
                        name: "FK_SongGenres_Genres_GenreId",
                        column: x => x.GenreId,
                        principalTable: "Genres",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SongGenres_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SongRatings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    SongId = table.Column<int>(type: "int", nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongRatings", x => x.Id);
                    table.CheckConstraint("CK_SongRatings_Rating", "[Rating] >= 1 AND [Rating] <= 5");
                    table.ForeignKey(
                        name: "FK_SongRatings_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SongRatings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SongTags",
                columns: table => new
                {
                    SongId = table.Column<int>(type: "int", nullable: false),
                    TagId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongTags", x => new { x.SongId, x.TagId });
                    table.ForeignKey(
                        name: "FK_SongTags_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SongTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Genres",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "חסידי" },
                    { 2, "ספרדי/מזרחי" },
                    { 3, "פופ" },
                    { 4, "רוק" },
                    { 5, "איטי" },
                    { 6, "שמח" },
                    { 7, "קרליבך" },
                    { 8, "ילדים" },
                    { 9, "נשים" },
                    { 10, "אנגלית" }
                });

            migrationBuilder.InsertData(
                table: "Instruments",
                columns: new[] { "Id", "EnglishName", "Name" },
                values: new object[,]
                {
                    { 1, "Guitar", "גיטרה" },
                    { 2, "Piano", "פסנתר" },
                    { 3, "Keyboard", "קלידים" },
                    { 4, "Organ", "אורגן" },
                    { 5, "Accordion", "עוגב" },
                    { 6, "Violin", "כינור" },
                    { 7, "Bass", "בס" },
                    { 8, "Drums", "תופים" },
                    { 9, "Ukulele", "יוקולילי" },
                    { 10, "Flute", "חליל" }
                });

            migrationBuilder.InsertData(
                table: "MusicalKeys",
                columns: new[] { "Id", "DisplayName", "IsMinor", "Name", "SemitoneOffset" },
                values: new object[,]
                {
                    { 1, "דו", false, "C", 0 },
                    { 2, "דו דיאז", false, "C#", 1 },
                    { 3, "רה", false, "D", 2 },
                    { 4, "רה דיאז", false, "D#", 3 },
                    { 5, "מי", false, "E", 4 },
                    { 6, "פה", false, "F", 5 },
                    { 7, "פה דיאז", false, "F#", 6 },
                    { 8, "סול", false, "G", 7 },
                    { 9, "סול דיאז", false, "G#", 8 },
                    { 10, "לה", false, "A", 9 },
                    { 11, "לה דיאז", false, "A#", 10 },
                    { 12, "סי", false, "B", 11 },
                    { 13, "לה מינור", true, "Am", 9 },
                    { 14, "לה דיאז מינור", true, "A#m", 10 },
                    { 15, "סי מינור", true, "Bm", 11 },
                    { 16, "דו מינור", true, "Cm", 0 },
                    { 17, "דו דיאז מינור", true, "C#m", 1 },
                    { 18, "רה מינור", true, "Dm", 2 },
                    { 19, "רה דיאז מינור", true, "D#m", 3 },
                    { 20, "מי מינור", true, "Em", 4 },
                    { 21, "פה מינור", true, "Fm", 5 },
                    { 22, "פה דיאז מינור", true, "F#m", 6 },
                    { 23, "סול מינור", true, "Gm", 7 },
                    { 24, "סול דיאז מינור", true, "G#m", 8 }
                });

            migrationBuilder.InsertData(
                table: "Tags",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "שבת" },
                    { 2, "חתונה" },
                    { 3, "חגים" },
                    { 4, "ראש השנה" },
                    { 5, "יום כיפור" },
                    { 6, "סוכות" },
                    { 7, "חנוכה" },
                    { 8, "פורים" },
                    { 9, "פסח" },
                    { 10, "ספירת העומר" },
                    { 11, "שבועות" },
                    { 12, "תשעה באב" },
                    { 13, "אמונה" },
                    { 14, "תודה" },
                    { 15, "תפילה" },
                    { 16, "שמחה" },
                    { 17, "עצוב" },
                    { 18, "מתחיל" },
                    { 19, "מתקדם" },
                    { 20, "קל לנגינה" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Artists_Name",
                table: "Artists",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Artists_PersonId",
                table: "Artists",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_Artists_UserId",
                table: "Artists",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ArtistSocialLinks_ArtistId",
                table: "ArtistSocialLinks",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_ReviewedByUserId",
                table: "ContentSubmissions",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_SongId",
                table: "ContentSubmissions",
                column: "SongId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_Status",
                table: "ContentSubmissions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_Status_IsDeleted",
                table: "ContentSubmissions",
                columns: new[] { "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_SubmittedAt",
                table: "ContentSubmissions",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ContentSubmissions_SubmittedByUserId",
                table: "ContentSubmissions",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_SongId",
                table: "Favorites",
                column: "SongId");

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_UserId",
                table: "Favorites",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_UserId_SongId",
                table: "Favorites",
                columns: new[] { "UserId", "SongId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Genres_Name",
                table: "Genres",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Instruments_Name",
                table: "Instruments",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MusicalKeys_Name",
                table: "MusicalKeys",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_People_Name",
                table: "People",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_SongArtists_ArtistId",
                table: "SongArtists",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_SongArtists_SongId",
                table: "SongArtists",
                column: "SongId");

            migrationBuilder.CreateIndex(
                name: "IX_SongArtists_SongId_ArtistId",
                table: "SongArtists",
                columns: new[] { "SongId", "ArtistId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SongGenres_GenreId",
                table: "SongGenres",
                column: "GenreId");

            migrationBuilder.CreateIndex(
                name: "IX_SongRatings_SongId",
                table: "SongRatings",
                column: "SongId");

            migrationBuilder.CreateIndex(
                name: "IX_SongRatings_SongId_Rating",
                table: "SongRatings",
                columns: new[] { "SongId", "Rating" });

            migrationBuilder.CreateIndex(
                name: "IX_SongRatings_UserId",
                table: "SongRatings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SongRatings_UserId_SongId",
                table: "SongRatings",
                columns: new[] { "UserId", "SongId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Songs_ArrangerId",
                table: "Songs",
                column: "ArrangerId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_ComposerId",
                table: "Songs",
                column: "ComposerId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_CreatedAt",
                table: "Songs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_EasyKeyId",
                table: "Songs",
                column: "EasyKeyId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_IsApproved",
                table: "Songs",
                column: "IsApproved");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_IsApproved_IsDeleted",
                table: "Songs",
                columns: new[] { "IsApproved", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Songs_Language_IsApproved",
                table: "Songs",
                columns: new[] { "Language", "IsApproved" });

            migrationBuilder.CreateIndex(
                name: "IX_Songs_LyricistId",
                table: "Songs",
                column: "LyricistId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_OriginalKeyId",
                table: "Songs",
                column: "OriginalKeyId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_Title",
                table: "Songs",
                column: "Title");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_UploadedByUserId",
                table: "Songs",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Songs_ViewCount",
                table: "Songs",
                column: "ViewCount");

            migrationBuilder.CreateIndex(
                name: "IX_SongTags_TagId",
                table: "SongTags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_Tags_Name",
                table: "Tags",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_GoogleId",
                table: "Users",
                column: "GoogleId",
                unique: true,
                filter: "[GoogleId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PreferredInstrumentId",
                table: "Users",
                column: "PreferredInstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArtistSocialLinks");

            migrationBuilder.DropTable(
                name: "ContentSubmissions");

            migrationBuilder.DropTable(
                name: "Favorites");

            migrationBuilder.DropTable(
                name: "SongArtists");

            migrationBuilder.DropTable(
                name: "SongGenres");

            migrationBuilder.DropTable(
                name: "SongRatings");

            migrationBuilder.DropTable(
                name: "SongTags");

            migrationBuilder.DropTable(
                name: "Artists");

            migrationBuilder.DropTable(
                name: "Genres");

            migrationBuilder.DropTable(
                name: "Songs");

            migrationBuilder.DropTable(
                name: "Tags");

            migrationBuilder.DropTable(
                name: "MusicalKeys");

            migrationBuilder.DropTable(
                name: "People");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Instruments");

            migrationBuilder.CreateTable(
                name: "Admins",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Admins", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Admins_Email",
                table: "Admins",
                column: "Email",
                unique: true);
        }
    }
}
