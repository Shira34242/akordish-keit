using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddArtistBannerAndPerformanceEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // סוג מדיית באנר (image / gif / video) ועוצמת טשטוש
            migrationBuilder.AddColumn<string>(
                name: "BannerMediaType",
                table: "Artists",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BannerBlur",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // קישור לאירוע בבאנר ההופעה
            migrationBuilder.AddColumn<int>(
                name: "PerformanceEventId",
                table: "Artists",
                type: "int",
                nullable: true);

            // תמונת באנר רחבה לאירוע (לתצוגה בדף האמן)
            migrationBuilder.AddColumn<string>(
                name: "BannerImageUrl",
                table: "Events",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Artists_PerformanceEventId",
                table: "Artists",
                column: "PerformanceEventId");

            migrationBuilder.AddForeignKey(
                name: "FK_Artists_Events_PerformanceEventId",
                table: "Artists",
                column: "PerformanceEventId",
                principalTable: "Events",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Backfill: זיהוי ה-BannerMediaType לאמנים קיימים לפי המידע הקיים
            migrationBuilder.Sql(@"
                UPDATE [Artists]
                SET [BannerMediaType] = CASE
                    WHEN [BannerGifUrl] IS NOT NULL AND LEN([BannerGifUrl]) > 0 THEN N'gif'
                    WHEN [BannerImageUrl] IS NOT NULL AND LEN([BannerImageUrl]) > 0 THEN N'image'
                    ELSE NULL
                END
                WHERE [BannerMediaType] IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Artists_Events_PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropIndex(
                name: "IX_Artists_PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerMediaType",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerBlur",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "PerformanceEventId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "BannerImageUrl",
                table: "Events");
        }
    }
}
