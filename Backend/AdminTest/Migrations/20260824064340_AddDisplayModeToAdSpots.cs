using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddDisplayModeToAdSpots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DisplayMode",
                table: "AdSpots",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisplayMode",
                table: "AdSpots");
        }
    }
}
