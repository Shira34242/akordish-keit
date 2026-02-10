using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionModelEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "ProfessionalRole",
                table: "Users");

            migrationBuilder.AddColumn<bool>(
                name: "IsPrimaryProfile",
                table: "MusicServiceProviders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SubscriptionId",
                table: "MusicServiceProviders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "MusicServiceProviders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SubscriptionId",
                table: "Artists",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "Artists",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Boosts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceProviderId = table.Column<int>(type: "int", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ExternalPaymentId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Type = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    PurchaseDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExpiryDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Boosts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Boosts_MusicServiceProviders_ServiceProviderId",
                        column: x => x.ServiceProviderId,
                        principalTable: "MusicServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviders_SubscriptionId",
                table: "MusicServiceProviders",
                column: "SubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_UserId",
                table: "MusicServiceProviders",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Artists_SubscriptionId",
                table: "Artists",
                column: "SubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_Boosts_IsActive",
                table: "Boosts",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Boosts_ServiceProviderId",
                table: "Boosts",
                column: "ServiceProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_Boosts_Type_IsActive",
                table: "Boosts",
                columns: new[] { "Type", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_Artists_Subscriptions_SubscriptionId",
                table: "Artists",
                column: "SubscriptionId",
                principalTable: "Subscriptions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviders_Subscriptions_SubscriptionId",
                table: "MusicServiceProviders",
                column: "SubscriptionId",
                principalTable: "Subscriptions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Artists_Subscriptions_SubscriptionId",
                table: "Artists");

            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviders_Subscriptions_SubscriptionId",
                table: "MusicServiceProviders");

            migrationBuilder.DropTable(
                name: "Boosts");

            migrationBuilder.DropIndex(
                name: "IX_MusicServiceProviders_SubscriptionId",
                table: "MusicServiceProviders");

            migrationBuilder.DropIndex(
                name: "IX_ServiceProviders_UserId",
                table: "MusicServiceProviders");

            migrationBuilder.DropIndex(
                name: "IX_Artists_SubscriptionId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "IsPrimaryProfile",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "SubscriptionId",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "Tier",
                table: "MusicServiceProviders");

            migrationBuilder.DropColumn(
                name: "SubscriptionId",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "Tier",
                table: "Artists");

            migrationBuilder.AddColumn<int>(
                name: "ProfessionalRole",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "MusicServiceProviders",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");
        }
    }
}
