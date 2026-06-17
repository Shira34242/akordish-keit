using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddArtistFeaturedFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Artists",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Artists_IsFeatured",
                table: "Artists",
                column: "IsFeatured");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Artists_IsFeatured",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "IsFeatured",
                table: "Artists");
        }
    }
}
