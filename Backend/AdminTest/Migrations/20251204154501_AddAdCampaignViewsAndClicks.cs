using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddAdCampaignViewsAndClicks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdCampaignClicks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AdCampaignId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ClickedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    Referrer = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdCampaignClicks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdCampaignClicks_AdCampaigns_AdCampaignId",
                        column: x => x.AdCampaignId,
                        principalTable: "AdCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AdCampaignClicks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "AdCampaignViews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AdCampaignId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ViewedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    Referrer = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdCampaignViews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdCampaignViews_AdCampaigns_AdCampaignId",
                        column: x => x.AdCampaignId,
                        principalTable: "AdCampaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AdCampaignViews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignClicks_AdCampaignId_IpAddress_UserAgent_ClickedAt",
                table: "AdCampaignClicks",
                columns: new[] { "AdCampaignId", "IpAddress", "UserAgent", "ClickedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignClicks_AdCampaignId_UserId_ClickedAt",
                table: "AdCampaignClicks",
                columns: new[] { "AdCampaignId", "UserId", "ClickedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignClicks_UserId",
                table: "AdCampaignClicks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignViews_AdCampaignId_IpAddress_UserAgent_ViewedAt",
                table: "AdCampaignViews",
                columns: new[] { "AdCampaignId", "IpAddress", "UserAgent", "ViewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignViews_AdCampaignId_UserId_ViewedAt",
                table: "AdCampaignViews",
                columns: new[] { "AdCampaignId", "UserId", "ViewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignViews_UserId",
                table: "AdCampaignViews",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdCampaignClicks");

            migrationBuilder.DropTable(
                name: "AdCampaignViews");
        }
    }
}
