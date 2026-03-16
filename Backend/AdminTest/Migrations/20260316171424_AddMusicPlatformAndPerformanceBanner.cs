using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddMusicPlatformAndPerformanceBanner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PerformanceImageUrl",
                table: "Artists",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PerformanceIsActive",
                table: "Artists",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PerformanceTicketUrl",
                table: "Artists",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PerformanceImageUrl",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "PerformanceIsActive",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "PerformanceTicketUrl",
                table: "Artists");
        }
    }
}
