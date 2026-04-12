using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddTeacherBannerAndSocialLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // אם עמודה קיימת — שנה אותה. אם לא — צור אותה.
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Address')
                    ALTER TABLE [Users] ALTER COLUMN [Address] nvarchar(max) NULL;
                ELSE
                    ALTER TABLE [Users] ADD [Address] nvarchar(max) NULL;
            ");

            migrationBuilder.AddColumn<string>(
                name: "BannerImageUrl",
                table: "MusicServiceProviders",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MusicServiceProviderSocialLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceProviderId = table.Column<int>(type: "int", nullable: false),
                    Platform = table.Column<int>(type: "int", nullable: false),
                    Url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MusicServiceProviderSocialLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MusicServiceProviderSocialLinks_MusicServiceProviders_ServiceProviderId",
                        column: x => x.ServiceProviderId,
                        principalTable: "MusicServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MusicServiceProviderSocialLinks_ServiceProviderId",
                table: "MusicServiceProviderSocialLinks",
                column: "ServiceProviderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MusicServiceProviderSocialLinks");

            migrationBuilder.DropColumn(
                name: "BannerImageUrl",
                table: "MusicServiceProviders");

            migrationBuilder.AlterColumn<string>(
                name: "Address",
                table: "Users",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);
        }
    }
}
