using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddContentUploaderTag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UploaderProfileType",
                table: "Songs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UploaderUserId",
                table: "Songs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UploaderProfileType",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UploaderUserId",
                table: "Articles",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Songs_UploaderUserId",
                table: "Songs",
                column: "UploaderUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_UploaderUserId",
                table: "Articles",
                column: "UploaderUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Articles_Users_UploaderUserId",
                table: "Articles",
                column: "UploaderUserId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Songs_Users_UploaderUserId",
                table: "Songs",
                column: "UploaderUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Articles_Users_UploaderUserId",
                table: "Articles");

            migrationBuilder.DropForeignKey(
                name: "FK_Songs_Users_UploaderUserId",
                table: "Songs");

            migrationBuilder.DropIndex(
                name: "IX_Songs_UploaderUserId",
                table: "Songs");

            migrationBuilder.DropIndex(
                name: "IX_Articles_UploaderUserId",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "UploaderProfileType",
                table: "Songs");

            migrationBuilder.DropColumn(
                name: "UploaderUserId",
                table: "Songs");

            migrationBuilder.DropColumn(
                name: "UploaderProfileType",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "UploaderUserId",
                table: "Articles");
        }
    }
}
