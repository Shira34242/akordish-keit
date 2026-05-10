using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260507120000_AddChordQuickSearchTags")]
    public partial class AddChordQuickSearchTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ChordQuickSearchOrder",
                table: "Tags",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "ShowInChordQuickSearch",
                table: "Tags",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Tags_ChordQuickSearch",
                table: "Tags",
                columns: new[] { "ShowInChordQuickSearch", "ChordQuickSearchOrder" });

            migrationBuilder.UpdateData(
                table: "Tags",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "ShowInChordQuickSearch", "ChordQuickSearchOrder" },
                values: new object[] { true, 1 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tags_ChordQuickSearch",
                table: "Tags");

            migrationBuilder.DropColumn(
                name: "ChordQuickSearchOrder",
                table: "Tags");

            migrationBuilder.DropColumn(
                name: "ShowInChordQuickSearch",
                table: "Tags");
        }
    }
}
