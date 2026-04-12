using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingColumnsFromSkippedMigrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BirthDate ב-Users — מהמיגרציה AddAddressAndBirthDateToUser שלא רצה
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BirthDate')
                    ALTER TABLE [Users] ADD [BirthDate] datetime2 NULL;
            ");

            // SubmittedByUserId ב-Events — מהמיגרציה AddSubmittedByUserIdToEvents שלא רצה
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'SubmittedByUserId')
                BEGIN
                    ALTER TABLE [Events] ADD [SubmittedByUserId] int NULL;
                    CREATE INDEX [IX_Events_SubmittedByUserId] ON [Events] ([SubmittedByUserId]);
                    ALTER TABLE [Events] ADD CONSTRAINT [FK_Events_Users_SubmittedByUserId]
                        FOREIGN KEY ([SubmittedByUserId]) REFERENCES [Users] ([Id]);
                END
            ");

            // IsDefault ב-Playlists — מהמיגרציה AddIsDefaultToPlaylist שלא רצה
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Playlists') AND name = 'IsDefault')
                    ALTER TABLE [Playlists] ADD [IsDefault] bit NOT NULL DEFAULT 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'BirthDate')
                    ALTER TABLE [Users] DROP COLUMN [BirthDate];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Events') AND name = 'SubmittedByUserId')
                BEGIN
                    ALTER TABLE [Events] DROP CONSTRAINT [FK_Events_Users_SubmittedByUserId];
                    DROP INDEX [IX_Events_SubmittedByUserId] ON [Events];
                    ALTER TABLE [Events] DROP COLUMN [SubmittedByUserId];
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Playlists') AND name = 'IsDefault')
                    ALTER TABLE [Playlists] DROP COLUMN [IsDefault];
            ");
        }
    }
}
