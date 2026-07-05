using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddTeacherQuickCategoryButtons : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryType') IS NULL
                        ALTER TABLE [MusicServiceProviderCategories]
                        ADD [QuickCategoryType] int NOT NULL CONSTRAINT [DF_MSPC_QuickCategoryType] DEFAULT 0;

                    IF COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryInstrumentId') IS NULL
                        ALTER TABLE [MusicServiceProviderCategories]
                        ADD [QuickCategoryInstrumentId] int NULL;

                    IF NOT EXISTS (
                        SELECT 1 FROM sys.foreign_keys
                        WHERE name = N'FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId'
                    ) AND OBJECT_ID(N'[Instruments]', N'U') IS NOT NULL
                        ALTER TABLE [MusicServiceProviderCategories]
                        ADD CONSTRAINT [FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId]
                            FOREIGN KEY ([QuickCategoryInstrumentId]) REFERENCES [Instruments] ([Id]);

                    IF NOT EXISTS (
                        SELECT 1 FROM sys.indexes
                        WHERE name = N'IX_MusicServiceProviderCategories_QuickCategoryInstrumentId'
                          AND object_id = OBJECT_ID(N'[MusicServiceProviderCategories]')
                    )
                        CREATE INDEX [IX_MusicServiceProviderCategories_QuickCategoryInstrumentId]
                            ON [MusicServiceProviderCategories] ([QuickCategoryInstrumentId]);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM sys.foreign_keys
                        WHERE name = N'FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId'
                    )
                        ALTER TABLE [MusicServiceProviderCategories]
                        DROP CONSTRAINT [FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId];

                    IF EXISTS (
                        SELECT 1 FROM sys.indexes
                        WHERE name = N'IX_MusicServiceProviderCategories_QuickCategoryInstrumentId'
                          AND object_id = OBJECT_ID(N'[MusicServiceProviderCategories]')
                    )
                        DROP INDEX [IX_MusicServiceProviderCategories_QuickCategoryInstrumentId]
                            ON [MusicServiceProviderCategories];

                    IF COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryInstrumentId') IS NOT NULL
                        ALTER TABLE [MusicServiceProviderCategories] DROP COLUMN [QuickCategoryInstrumentId];

                    IF COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryType') IS NOT NULL
                        ALTER TABLE [MusicServiceProviderCategories] DROP COLUMN [QuickCategoryType];
                END
            ");
        }
    }
}
