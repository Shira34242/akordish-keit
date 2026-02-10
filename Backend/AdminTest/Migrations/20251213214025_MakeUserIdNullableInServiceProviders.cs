using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class MakeUserIdNullableInServiceProviders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "MusicServiceProviders",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders");

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "MusicServiceProviders",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders",
                column: "UserId",
                unique: true);
        }
    }
}
