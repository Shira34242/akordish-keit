using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddTeacherQuickCategoryButtons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuickCategoryType",
                table: "MusicServiceProviderCategories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderCategories_QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories",
                column: "QuickCategoryInstrumentId");

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories",
                column: "QuickCategoryInstrumentId",
                principalTable: "Instruments",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviderCategories_QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "QuickCategoryInstrumentId",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "QuickCategoryType",
                table: "MusicServiceProviderCategories");
        }
    }
}
