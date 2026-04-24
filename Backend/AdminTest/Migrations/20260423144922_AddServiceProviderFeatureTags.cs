using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceProviderFeatureTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasAccessibleEntrance",
                table: "MusicServiceProviders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnash",
                table: "MusicServiceProviders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ParkingType",
                table: "MusicServiceProviders",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasAccessibleEntrance",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "IsAnash",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "ParkingType",
                table: "MusicServiceProviders");
        }
    }
}
