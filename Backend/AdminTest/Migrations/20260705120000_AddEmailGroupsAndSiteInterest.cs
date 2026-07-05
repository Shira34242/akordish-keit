using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddEmailGroupsAndSiteInterest : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[EmailGroups]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [EmailGroups] (
                        [Id]              int           NOT NULL IDENTITY,
                        [Name]            nvarchar(160) NOT NULL,
                        [Description]     nvarchar(500) NULL,
                        [IsDeleted]       bit           NOT NULL CONSTRAINT [DF_EmailGroups_IsDeleted] DEFAULT CAST(0 AS bit),
                        [CreatedAt]       datetime2     NOT NULL CONSTRAINT [DF_EmailGroups_CreatedAt] DEFAULT (GETUTCDATE()),
                        [UpdatedAt]       datetime2     NULL,
                        [CreatedByUserId] int           NOT NULL,
                        CONSTRAINT [PK_EmailGroups] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_EmailGroups_Users_CreatedByUserId]
                            FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                    );
                END

                IF OBJECT_ID(N'[EmailGroupMembers]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [EmailGroupMembers] (
                        [EmailGroupId] int       NOT NULL,
                        [UserId]       int       NOT NULL,
                        [AddedAt]      datetime2 NOT NULL CONSTRAINT [DF_EmailGroupMembers_AddedAt] DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_EmailGroupMembers] PRIMARY KEY ([EmailGroupId], [UserId]),
                        CONSTRAINT [FK_EmailGroupMembers_EmailGroups_EmailGroupId]
                            FOREIGN KEY ([EmailGroupId]) REFERENCES [EmailGroups] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_EmailGroupMembers_Users_UserId]
                            FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
                    );
                END

                IF OBJECT_ID(N'[SiteInterestRegistrations]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [SiteInterestRegistrations] (
                        [Id]        int           NOT NULL IDENTITY,
                        [Email]     nvarchar(320) NOT NULL,
                        [Source]    nvarchar(100) NULL,
                        [CreatedAt] datetime2     NOT NULL CONSTRAINT [DF_SiteInterest_CreatedAt] DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_SiteInterestRegistrations] PRIMARY KEY ([Id])
                    );
                    CREATE UNIQUE INDEX [IX_SiteInterestRegistrations_Email] ON [SiteInterestRegistrations] ([Email]);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[EmailGroupMembers]', N'U') IS NOT NULL DROP TABLE [EmailGroupMembers];
                IF OBJECT_ID(N'[EmailGroups]',       N'U') IS NOT NULL DROP TABLE [EmailGroups];
                IF OBJECT_ID(N'[SiteInterestRegistrations]', N'U') IS NOT NULL DROP TABLE [SiteInterestRegistrations];
            ");
        }
    }
}
