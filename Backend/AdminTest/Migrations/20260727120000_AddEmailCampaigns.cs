using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations;

public partial class AddEmailCampaigns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "EmailCampaigns",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                HtmlBody = table.Column<string>(type: "nvarchar(max)", nullable: false),
                FromName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                RecipientGroup = table.Column<int>(type: "int", nullable: false),
                EmailGroupId = table.Column<int>(type: "int", nullable: true),
                Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                ScheduledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                SentCount = table.Column<int>(type: "int", nullable: false),
                FailedCount = table.Column<int>(type: "int", nullable: false),
                OpenCount = table.Column<int>(type: "int", nullable: false),
                ClickCount = table.Column<int>(type: "int", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_EmailCampaigns", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_EmailCampaigns_Status_ScheduledAt", table: "EmailCampaigns", columns: new[] { "Status", "ScheduledAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "EmailCampaigns");
}
