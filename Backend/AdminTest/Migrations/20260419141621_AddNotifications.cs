using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Notifications]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [Notifications] (
                        [Id] int NOT NULL IDENTITY,
                        [UserId] int NOT NULL,
                        [Title] nvarchar(160) NOT NULL,
                        [Message] nvarchar(1000) NOT NULL,
                        [Type] int NOT NULL,
                        [Category] int NOT NULL,
                        [RelatedEntityType] nvarchar(80) NULL,
                        [RelatedEntityId] int NULL,
                        [ActionUrl] nvarchar(500) NULL,
                        [IsRead] bit NOT NULL CONSTRAINT [DF_Notifications_IsRead] DEFAULT CAST(0 AS bit),
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (GETUTCDATE()),
                        [ReadAt] datetime2 NULL,
                        [CreatedByUserId] int NULL,
                        [IsDeleted] bit NOT NULL CONSTRAINT [DF_Notifications_IsDeleted] DEFAULT CAST(0 AS bit),
                        [DeletedAt] datetime2 NULL,
                        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_Notifications_Users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
                        CONSTRAINT [FK_Notifications_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                    );
                END

                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_CreatedByUserId' AND object_id = OBJECT_ID(N'[Notifications]'))
                BEGIN
                    CREATE INDEX [IX_Notifications_CreatedByUserId] ON [Notifications] ([CreatedByUserId]);
                END

                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_RelatedEntity' AND object_id = OBJECT_ID(N'[Notifications]'))
                BEGIN
                    CREATE INDEX [IX_Notifications_RelatedEntity] ON [Notifications] ([RelatedEntityType], [RelatedEntityId]);
                END

                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_User_Read_Deleted_Created' AND object_id = OBJECT_ID(N'[Notifications]'))
                BEGIN
                    CREATE INDEX [IX_Notifications_User_Read_Deleted_Created] ON [Notifications] ([UserId], [IsRead], [IsDeleted], [CreatedAt]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE [Notifications];
                END
            ");
        }
    }
}
