using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddChordBookExportCountToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "ArticleCategories",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.Sql(@"IF COL_LENGTH('Users', 'ChordBookExportCount') IS NULL BEGIN ALTER TABLE [Users] ADD [ChordBookExportCount] int NOT NULL DEFAULT 0; END");

            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[Agencies]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [Agencies] (
                        [Id] int NOT NULL IDENTITY,
                        [Name] nvarchar(200) NOT NULL,
                        [Slug] nvarchar(220) NOT NULL,
                        [LogoUrl] nvarchar(500) NULL,
                        [BannerImageUrl] nvarchar(500) NULL,
                        [ShortDescription] nvarchar(500) NULL,
                        [FullDescription] nvarchar(4000) NULL,
                        [PhoneNumber] nvarchar(20) NULL,
                        [WhatsAppNumber] nvarchar(20) NULL,
                        [Email] nvarchar(200) NULL,
                        [WebsiteUrl] nvarchar(500) NULL,
                        [BrandPrimaryColor] nvarchar(20) NULL,
                        [BrandSecondaryColor] nvarchar(20) NULL,
                        [BrandTextColor] nvarchar(20) NULL,
                        [IsActive] bit NOT NULL,
                        [ShowInIndexBanner] bit NOT NULL,
                        [DisplayOrder] int NOT NULL,
                        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                        [UpdatedAt] datetime2 NULL,
                        [IsDeleted] bit NOT NULL,
                        CONSTRAINT [PK_Agencies] PRIMARY KEY ([Id])
                    );
                END

                IF OBJECT_ID(N'[AgencyContents]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencyContents] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [ContentType] nvarchar(40) NOT NULL,
                        [ContentId] int NOT NULL,
                        [IsFeatured] bit NOT NULL,
                        [DisplayOrder] int NOT NULL,
                        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_AgencyContents] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencyContents_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencyGalleryImages] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [ImageUrl] nvarchar(500) NOT NULL,
                        [Caption] nvarchar(200) NULL,
                        [DisplayOrder] int NOT NULL DEFAULT 0,
                        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_AgencyGalleryImages] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencyGalleryImages_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF OBJECT_ID(N'[AgencyProfiles]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencyProfiles] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [ProfileType] nvarchar(40) NOT NULL,
                        [ProfileId] int NOT NULL,
                        [ContactMode] int NOT NULL DEFAULT 0,
                        [ShowBadge] bit NOT NULL DEFAULT 1,
                        [IsFeaturedByAgency] bit NOT NULL,
                        [DisplayOrder] int NOT NULL,
                        [CreatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_AgencyProfiles] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencyProfiles_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF OBJECT_ID(N'[AgencySocialLinks]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencySocialLinks] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [Platform] int NOT NULL,
                        [Url] nvarchar(500) NOT NULL,
                        CONSTRAINT [PK_AgencySocialLinks] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencySocialLinks_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_IsDeleted_IsActive_ShowInIndexBanner_DisplayOrder' AND object_id = OBJECT_ID(N'[Agencies]'))
                    CREATE INDEX [IX_Agencies_IsDeleted_IsActive_ShowInIndexBanner_DisplayOrder] ON [Agencies] ([IsDeleted], [IsActive], [ShowInIndexBanner], [DisplayOrder]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_Slug' AND object_id = OBJECT_ID(N'[Agencies]'))
                    CREATE UNIQUE INDEX [IX_Agencies_Slug] ON [Agencies] ([Slug]) WHERE [IsDeleted] = 0;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyContents_AgencyId_ContentType_ContentId' AND object_id = OBJECT_ID(N'[AgencyContents]'))
                    CREATE UNIQUE INDEX [IX_AgencyContents_AgencyId_ContentType_ContentId] ON [AgencyContents] ([AgencyId], [ContentType], [ContentId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyGalleryImages_AgencyId' AND object_id = OBJECT_ID(N'[AgencyGalleryImages]'))
                    CREATE INDEX [IX_AgencyGalleryImages_AgencyId] ON [AgencyGalleryImages] ([AgencyId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_AgencyId_ProfileType_ProfileId' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
                    CREATE UNIQUE INDEX [IX_AgencyProfiles_AgencyId_ProfileType_ProfileId] ON [AgencyProfiles] ([AgencyId], [ProfileType], [ProfileId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_ProfileType_ProfileId' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
                    CREATE UNIQUE INDEX [IX_AgencyProfiles_ProfileType_ProfileId] ON [AgencyProfiles] ([ProfileType], [ProfileId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencySocialLinks_AgencyId' AND object_id = OBJECT_ID(N'[AgencySocialLinks]'))
                    CREATE INDEX [IX_AgencySocialLinks_AgencyId] ON [AgencySocialLinks] ([AgencyId]);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[AgencySocialLinks]', N'U') IS NOT NULL DROP TABLE [AgencySocialLinks];
                IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NOT NULL DROP TABLE [AgencyGalleryImages];
                IF OBJECT_ID(N'[AgencyProfiles]', N'U') IS NOT NULL DROP TABLE [AgencyProfiles];
                IF OBJECT_ID(N'[AgencyContents]', N'U') IS NOT NULL DROP TABLE [AgencyContents];
                IF OBJECT_ID(N'[Agencies]', N'U') IS NOT NULL DROP TABLE [Agencies];
            ");

            migrationBuilder.Sql(@"IF COL_LENGTH('Users', 'ChordBookExportCount') IS NOT NULL BEGIN ALTER TABLE [Users] DROP COLUMN [ChordBookExportCount]; END");

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name" },
                values: new object[,]
                {
                    { 1, "כללי", "General" },
                    { 2, "חדשות", "News" }
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name", "Section" },
                values: new object[,]
                {
                    { 3, "ביקורות", "Reviews", 1 },
                    { 4, "ראיונות", "Interviews", 1 },
                    { 5, "כתבות מיוחדות", "Features", 1 }
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name" },
                values: new object[] { 6, "כתבות הופעות", "LiveReports" });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name", "Section" },
                values: new object[,]
                {
                    { 7, "ביקורות אלבומים", "AlbumReviews", 1 },
                    { 8, "טכנולוגיה מוזיקלית", "MusicTech", 1 },
                    { 9, "לימוד וחינוך", "Education", 1 }
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name" },
                values: new object[,]
                {
                    { 10, "פופולארי", "Popular" },
                    { 11, "קליפים", "Clips" }
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name", "Section" },
                values: new object[,]
                {
                    { 12, "בלוג", "Blog", 1 },
                    { 13, "דעה", "Opinion", 1 }
                });

            migrationBuilder.InsertData(
                table: "ArticleCategories",
                columns: new[] { "Id", "DisplayName", "Name" },
                values: new object[,]
                {
                    { 14, "מצעדים", "Charts" },
                    { 15, "מאחורי הקלעים", "BehindTheScenes" }
                });
        }
    }
}
