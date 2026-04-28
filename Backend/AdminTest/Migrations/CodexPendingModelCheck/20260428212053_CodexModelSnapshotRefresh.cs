using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations.CodexPendingModelCheck
{
    /// <inheritdoc />
    public partial class CodexModelSnapshotRefresh : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QuickCategoryImageUrl",
                table: "MusicServiceProviderCategories",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuickCategoryLabel",
                table: "MusicServiceProviderCategories",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuickCategoryOrder",
                table: "MusicServiceProviderCategories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "ShowInQuickCategories",
                table: "MusicServiceProviderCategories",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuickCategoryImageUrl",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "QuickCategoryLabel",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "QuickCategoryOrder",
                table: "MusicServiceProviderCategories");

            migrationBuilder.DropColumn(
                name: "ShowInQuickCategories",
                table: "MusicServiceProviderCategories");
        }
    }
}
