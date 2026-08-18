using System;
using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260818102000_AddRewardWallets")]
    public partial class AddRewardWallets : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ActivationRewardedAt",
                table: "UserReferrals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ContributionRewardedAt",
                table: "UserReferrals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserRewardWallets",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CoinBalance = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    AwardedContentCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    LegacyConvertedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRewardWallets", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserRewardWallets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRewardTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<int>(type: "int", nullable: false),
                    BalanceAfter = table.Column<int>(type: "int", nullable: false),
                    ActionType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ReferenceType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ReferenceId = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRewardTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRewardTransactions_UserRewardWallets_UserId",
                        column: x => x.UserId,
                        principalTable: "UserRewardWallets",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_UserRewardTransactions_IdempotencyKey", table: "UserRewardTransactions", column: "IdempotencyKey", unique: true);
            migrationBuilder.CreateIndex(name: "IX_UserRewardTransactions_UserId_CreatedAt", table: "UserRewardTransactions", columns: new[] { "UserId", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserRewardTransactions");
            migrationBuilder.DropTable(name: "UserRewardWallets");
            migrationBuilder.DropColumn(name: "ActivationRewardedAt", table: "UserReferrals");
            migrationBuilder.DropColumn(name: "ContributionRewardedAt", table: "UserReferrals");
        }
    }
}
