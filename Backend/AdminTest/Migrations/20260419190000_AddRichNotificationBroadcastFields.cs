using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddRichNotificationBroadcastFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH(N'[Notifications]', N'MediaUrl') IS NULL
                        ALTER TABLE [Notifications] ADD [MediaUrl] nvarchar(1000) NULL;

                    IF COL_LENGTH(N'[Notifications]', N'MediaType') IS NULL
                        ALTER TABLE [Notifications] ADD [MediaType] nvarchar(40) NULL;

                    IF COL_LENGTH(N'[Notifications]', N'MediaThumbnailUrl') IS NULL
                        ALTER TABLE [Notifications] ADD [MediaThumbnailUrl] nvarchar(1000) NULL;

                    IF COL_LENGTH(N'[Notifications]', N'MediaAltText') IS NULL
                        ALTER TABLE [Notifications] ADD [MediaAltText] nvarchar(200) NULL;

                    IF COL_LENGTH(N'[Notifications]', N'CampaignName') IS NULL
                        ALTER TABLE [Notifications] ADD [CampaignName] nvarchar(160) NULL;

                    IF COL_LENGTH(N'[Notifications]', N'AudienceLabel') IS NULL
                        ALTER TABLE [Notifications] ADD [AudienceLabel] nvarchar(300) NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH(N'[Notifications]', N'AudienceLabel') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [AudienceLabel];

                    IF COL_LENGTH(N'[Notifications]', N'CampaignName') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [CampaignName];

                    IF COL_LENGTH(N'[Notifications]', N'MediaAltText') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [MediaAltText];

                    IF COL_LENGTH(N'[Notifications]', N'MediaThumbnailUrl') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [MediaThumbnailUrl];

                    IF COL_LENGTH(N'[Notifications]', N'MediaType') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [MediaType];

                    IF COL_LENGTH(N'[Notifications]', N'MediaUrl') IS NOT NULL
                        ALTER TABLE [Notifications] DROP COLUMN [MediaUrl];
                END
            ");
        }
    }
}
