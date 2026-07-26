using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations;

[DbContext(typeof(AkordishKeitDbContext))]
[Migration("20260726120000_AddMarketingUnsubscribes")]
public partial class AddMarketingUnsubscribes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MarketingUnsubscribes",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                UnsubscribedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MarketingUnsubscribes", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_MarketingUnsubscribes_Email",
            table: "MarketingUnsubscribes",
            column: "Email",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "MarketingUnsubscribes");
    }
}
