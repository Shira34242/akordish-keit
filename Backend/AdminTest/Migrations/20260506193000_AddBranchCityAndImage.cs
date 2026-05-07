using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260506193000_AddBranchCityAndImage")]
    public partial class AddBranchCityAndImage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CityId",
                table: "MusicServiceProviderBranches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "MusicServiceProviderBranches",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderBranches_CityId",
                table: "MusicServiceProviderBranches",
                column: "CityId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviderBranches_CityId",
                table: "MusicServiceProviderBranches");

            migrationBuilder.DropColumn(
                name: "CityId",
                table: "MusicServiceProviderBranches");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "MusicServiceProviderBranches");
        }
    }
}
