using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddNotificationGroups : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[NotificationGroups]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [NotificationGroups] (
                        [Id] int NOT NULL IDENTITY,
                        [Name] nvarchar(160) NOT NULL,
                        [Description] nvarchar(500) NULL,
                        [ImageUrl] nvarchar(1000) NULL,
                        [SendToAll] bit NOT NULL CONSTRAINT [DF_NotificationGroups_SendToAll] DEFAULT CAST(0 AS bit),
                        [Role] int NULL,
                        [IsActive] bit NULL,
                        [ContentTag] int NULL,
                        [PreferredInstrumentId] int NULL,
                        [JoinedFrom] datetime2 NULL,
                        [JoinedTo] datetime2 NULL,
                        [AddressContains] nvarchar(200) NULL,
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_NotificationGroups_CreatedAt] DEFAULT (GETUTCDATE()),
                        [UpdatedAt] datetime2 NULL,
                        [IsDeleted] bit NOT NULL CONSTRAINT [DF_NotificationGroups_IsDeleted] DEFAULT CAST(0 AS bit),
                        [CreatedByUserId] int NOT NULL,
                        CONSTRAINT [PK_NotificationGroups] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_NotificationGroups_Users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                    );
                END

                IF OBJECT_ID(N'[NotificationGroups]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NotificationGroups_Deleted_Created' AND object_id = OBJECT_ID(N'[NotificationGroups]'))
                BEGIN
                    CREATE INDEX [IX_NotificationGroups_Deleted_Created] ON [NotificationGroups] ([IsDeleted], [CreatedAt]);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[NotificationGroups]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [NotificationGroups];
                END
            ");
        }
    }
}
