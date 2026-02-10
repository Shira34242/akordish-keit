using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class RemoveOrderAndEnglishNameFromCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviderCategories_Order",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "EnglishName",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "Order",
                table: "MusicServiceProviderCategories");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EnglishName",
                table: "MusicServiceProviderCategories",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Order",
                table: "MusicServiceProviderCategories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderCategories_Order",
                table: "MusicServiceProviderCategories",
                column: "Order");
        }
    }
}
