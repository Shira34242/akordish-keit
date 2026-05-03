using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260503113000_OptimizeProfessionalsIndexPaging")]
    public partial class OptimizeProfessionalsIndexPaging : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_CityId",
                table: "MusicServiceProviders",
                column: "CityId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_PublicIndex",
                table: "MusicServiceProviders",
                columns: new[] { "IsDeleted", "Status", "IsTeacher", "IsFeatured", "Tier", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Teachers_Languages",
                table: "Teachers",
                column: "Languages");

            migrationBuilder.CreateIndex(
                name: "IX_Teachers_TargetAudience",
                table: "Teachers",
                column: "TargetAudience");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceProviders_CityId",
                table: "MusicServiceProviders");

            migrationBuilder.DropIndex(
                name: "IX_ServiceProviders_PublicIndex",
                table: "MusicServiceProviders");

            migrationBuilder.DropIndex(
                name: "IX_Teachers_Languages",
                table: "Teachers");

            migrationBuilder.DropIndex(
                name: "IX_Teachers_TargetAudience",
                table: "Teachers");
        }
    }
}
