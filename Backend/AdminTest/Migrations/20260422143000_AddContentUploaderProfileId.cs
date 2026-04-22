using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260422143000_AddContentUploaderProfileId")]
    public partial class AddContentUploaderProfileId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "UploaderProfileType",
                table: "Songs",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UploaderProfileId",
                table: "Songs",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "UploaderProfileType",
                table: "Articles",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UploaderProfileId",
                table: "Articles",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Songs_UploaderProfile",
                table: "Songs",
                columns: new[] { "UploaderProfileType", "UploaderProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_UploaderProfile",
                table: "Articles",
                columns: new[] { "UploaderProfileType", "UploaderProfileId" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Songs_UploaderProfile",
                table: "Songs");

            migrationBuilder.DropIndex(
                name: "IX_Articles_UploaderProfile",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "UploaderProfileId",
                table: "Songs");

            migrationBuilder.AlterColumn<string>(
                name: "UploaderProfileType",
                table: "Songs",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "UploaderProfileId",
                table: "Articles");

            migrationBuilder.AlterColumn<string>(
                name: "UploaderProfileType",
                table: "Articles",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);
        }
    }
}
