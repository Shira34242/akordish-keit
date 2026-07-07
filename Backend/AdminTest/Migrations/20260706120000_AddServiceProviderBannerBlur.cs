using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddServiceProviderBannerBlur : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[MusicServiceProviders]', N'U') IS NOT NULL
                   AND COL_LENGTH(N'[MusicServiceProviders]', N'BannerBlur') IS NULL
                    ALTER TABLE [MusicServiceProviders]
                    ADD [BannerBlur] int NOT NULL CONSTRAINT [DF_MusicServiceProviders_BannerBlur] DEFAULT 0;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[MusicServiceProviders]', N'U') IS NOT NULL
                   AND COL_LENGTH(N'[MusicServiceProviders]', N'BannerBlur') IS NOT NULL
                    ALTER TABLE [MusicServiceProviders] DROP COLUMN [BannerBlur];
            ");
        }
    }
}
