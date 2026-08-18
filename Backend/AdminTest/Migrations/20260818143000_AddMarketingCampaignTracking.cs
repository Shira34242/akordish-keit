using System;
using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260818143000_AddMarketingCampaignTracking")]
    public partial class AddMarketingCampaignTracking : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MarketingCampaigns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    TargetPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketingCampaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketingCampaigns_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MarketingCampaignEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MarketingCampaignId = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VisitorId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    PagePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Referrer = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketingCampaignEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MarketingCampaignEvents_MarketingCampaigns_MarketingCampaignId",
                        column: x => x.MarketingCampaignId,
                        principalTable: "MarketingCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MarketingCampaignEvents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaigns_Code",
                table: "MarketingCampaigns",
                column: "Code",
                unique: true);
            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaigns_CreatedByUserId",
                table: "MarketingCampaigns",
                column: "CreatedByUserId");
            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaigns_IsActive_CreatedAt",
                table: "MarketingCampaigns",
                columns: new[] { "IsActive", "CreatedAt" });
            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaignEvents_MarketingCampaignId_EventType_OccurredAt",
                table: "MarketingCampaignEvents",
                columns: new[] { "MarketingCampaignId", "EventType", "OccurredAt" });
            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaignEvents_MarketingCampaignId_VisitorId_EventType",
                table: "MarketingCampaignEvents",
                columns: new[] { "MarketingCampaignId", "VisitorId", "EventType" });
            migrationBuilder.CreateIndex(
                name: "IX_MarketingCampaignEvents_UserId_EventType",
                table: "MarketingCampaignEvents",
                columns: new[] { "UserId", "EventType" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "MarketingCampaignEvents");
            migrationBuilder.DropTable(name: "MarketingCampaigns");
        }
    }
}
