using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingBannerColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Artists: BannerMediaType
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'BannerMediaType')
                    ALTER TABLE [Artists] ADD [BannerMediaType] nvarchar(20) NULL;
            ");

            // Artists: BannerBlur
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'BannerBlur')
                    ALTER TABLE [Artists] ADD [BannerBlur] int NOT NULL DEFAULT 0;
            ");

            // Artists: PerformanceEventId
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'PerformanceEventId')
                    ALTER TABLE [Artists] ADD [PerformanceEventId] int NULL;
            ");

            // Events: BannerImageUrl
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'BannerImageUrl')
                    ALTER TABLE [Events] ADD [BannerImageUrl] nvarchar(500) NULL;
            ");

            // FK + Index for PerformanceEventId
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Artists_PerformanceEventId' AND object_id = OBJECT_ID('Artists'))
                    CREATE INDEX IX_Artists_PerformanceEventId ON [Artists] ([PerformanceEventId]);
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Artists_Events_PerformanceEventId')
                    ALTER TABLE [Artists] ADD CONSTRAINT FK_Artists_Events_PerformanceEventId
                        FOREIGN KEY ([PerformanceEventId]) REFERENCES [Events]([Id]) ON DELETE SET NULL;
            ");

            // Backfill BannerMediaType
            migrationBuilder.Sql(@"
                UPDATE [Artists]
                SET [BannerMediaType] = CASE
                    WHEN [BannerGifUrl] IS NOT NULL AND LEN([BannerGifUrl]) > 0 THEN N'gif'
                    WHEN [BannerImageUrl] IS NOT NULL AND LEN([BannerImageUrl]) > 0 THEN N'image'
                    ELSE NULL
                END
                WHERE [BannerMediaType] IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Artists_Events_PerformanceEventId')
                    ALTER TABLE [Artists] DROP CONSTRAINT FK_Artists_Events_PerformanceEventId;
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Artists_PerformanceEventId' AND object_id = OBJECT_ID('Artists'))
                    DROP INDEX IX_Artists_PerformanceEventId ON [Artists];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'BannerMediaType')
                    ALTER TABLE [Artists] DROP COLUMN [BannerMediaType];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'BannerBlur')
                    ALTER TABLE [Artists] DROP COLUMN [BannerBlur];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Artists') AND name = 'PerformanceEventId')
                    ALTER TABLE [Artists] DROP COLUMN [PerformanceEventId];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'BannerImageUrl')
                    ALTER TABLE [Events] DROP COLUMN [BannerImageUrl];
            ");
        }
    }
}
