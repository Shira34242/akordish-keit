using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceProviderBranches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MusicServiceProviderBranches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceProviderId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OpeningHours = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MusicServiceProviderBranches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MusicServiceProviderBranches_ServiceProviders_ServiceProviderId",
                        column: x => x.ServiceProviderId,
                        principalTable: "MusicServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderBranches_Order",
                table: "MusicServiceProviderBranches",
                column: "Order");

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderBranches_ServiceProviderId",
                table: "MusicServiceProviderBranches",
                column: "ServiceProviderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MusicServiceProviderBranches");
        }
    }
}
