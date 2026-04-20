using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddNotificationGroupMembersAndAttachments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                   AND COL_LENGTH(N'[Notifications]', N'AttachmentsJson') IS NULL
                    ALTER TABLE [Notifications] ADD [AttachmentsJson] nvarchar(max) NULL;

                IF OBJECT_ID(N'[NotificationGroupMembers]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [NotificationGroupMembers] (
                        [NotificationGroupId] int NOT NULL,
                        [UserId] int NOT NULL,
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_NotificationGroupMembers_CreatedAt] DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_NotificationGroupMembers] PRIMARY KEY ([NotificationGroupId], [UserId]),
                        CONSTRAINT [FK_NotificationGroupMembers_NotificationGroups_NotificationGroupId] FOREIGN KEY ([NotificationGroupId]) REFERENCES [NotificationGroups] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_NotificationGroupMembers_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                    );
                END

                IF OBJECT_ID(N'[NotificationGroupMembers]', N'U') IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NotificationGroupMembers_UserId' AND object_id = OBJECT_ID(N'[NotificationGroupMembers]'))
                    CREATE INDEX [IX_NotificationGroupMembers_UserId] ON [NotificationGroupMembers] ([UserId]);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[NotificationGroupMembers]', N'U') IS NOT NULL
                    DROP TABLE [NotificationGroupMembers];

                IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
                   AND COL_LENGTH(N'[Notifications]', N'AttachmentsJson') IS NOT NULL
                    ALTER TABLE [Notifications] DROP COLUMN [AttachmentsJson];
            ");
        }
    }
}
