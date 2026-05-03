using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class PendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Articles_CreatedAt' AND object_id = OBJECT_ID('Articles'))
                    CREATE INDEX IX_Articles_CreatedAt ON Articles (CreatedAt);
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Articles_Status_ContentType_CreatedAt' AND object_id = OBJECT_ID('Articles'))
                    CREATE INDEX IX_Articles_Status_ContentType_CreatedAt ON Articles (Status, ContentType, CreatedAt DESC);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Articles_CreatedAt",
                table: "Articles");

            migrationBuilder.DropIndex(
                name: "IX_Articles_Status_ContentType_CreatedAt",
                table: "Articles");
        }
    }
}
