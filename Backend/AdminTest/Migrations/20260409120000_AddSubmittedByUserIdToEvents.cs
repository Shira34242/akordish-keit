using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmittedByUserIdToEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SubmittedByUserId",
                table: "Events",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_SubmittedByUserId",
                table: "Events",
                column: "SubmittedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Events_Users_SubmittedByUserId",
                table: "Events",
                column: "SubmittedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Events_Users_SubmittedByUserId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Events_SubmittedByUserId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                table: "Events");
        }
    }
}
