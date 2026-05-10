using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    public partial class AddAgenciesModule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                        [IsActive] bit NOT NULL CONSTRAINT [DF_Agencies_IsActive] DEFAULT CAST(1 AS bit),
                        [ShowInIndexBanner] bit NOT NULL CONSTRAINT [DF_Agencies_ShowInIndexBanner] DEFAULT CAST(0 AS bit),
                        [DisplayOrder] int NOT NULL CONSTRAINT [DF_Agencies_DisplayOrder] DEFAULT 0,
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Agencies_CreatedAt] DEFAULT (GETUTCDATE()),
                        [UpdatedAt] datetime2 NULL,
                        [IsDeleted] bit NOT NULL CONSTRAINT [DF_Agencies_IsDeleted] DEFAULT CAST(0 AS bit),
                        CONSTRAINT [PK_Agencies] PRIMARY KEY ([Id])
                    );
                END

                IF OBJECT_ID(N'[AgencyProfiles]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencyProfiles] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [ProfileType] nvarchar(40) NOT NULL,
                        [ProfileId] int NOT NULL,
                        [ContactMode] int NOT NULL CONSTRAINT [DF_AgencyProfiles_ContactMode] DEFAULT 0,
                        [ShowBadge] bit NOT NULL CONSTRAINT [DF_AgencyProfiles_ShowBadge] DEFAULT CAST(1 AS bit),
                        [IsFeaturedByAgency] bit NOT NULL CONSTRAINT [DF_AgencyProfiles_IsFeaturedByAgency] DEFAULT CAST(0 AS bit),
                        [DisplayOrder] int NOT NULL CONSTRAINT [DF_AgencyProfiles_DisplayOrder] DEFAULT 0,
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgencyProfiles_CreatedAt] DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_AgencyProfiles] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencyProfiles_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF OBJECT_ID(N'[AgencyContents]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AgencyContents] (
                        [Id] int NOT NULL IDENTITY,
                        [AgencyId] int NOT NULL,
                        [ContentType] nvarchar(40) NOT NULL,
                        [ContentId] int NOT NULL,
                        [IsFeatured] bit NOT NULL CONSTRAINT [DF_AgencyContents_IsFeatured] DEFAULT CAST(0 AS bit),
                        [DisplayOrder] int NOT NULL CONSTRAINT [DF_AgencyContents_DisplayOrder] DEFAULT 0,
                        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgencyContents_CreatedAt] DEFAULT (GETUTCDATE()),
                        CONSTRAINT [PK_AgencyContents] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_AgencyContents_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
                    );
                END

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_Slug' AND object_id = OBJECT_ID(N'[Agencies]'))
                    CREATE UNIQUE INDEX [IX_Agencies_Slug] ON [Agencies] ([Slug]) WHERE [IsDeleted] = 0;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_PublicBanners' AND object_id = OBJECT_ID(N'[Agencies]'))
                    CREATE INDEX [IX_Agencies_PublicBanners] ON [Agencies] ([IsDeleted], [IsActive], [ShowInIndexBanner], [DisplayOrder]);

                IF COL_LENGTH('Agencies', 'BrandPrimaryColor') IS NULL
                    ALTER TABLE [Agencies] ADD [BrandPrimaryColor] nvarchar(20) NULL;
                IF COL_LENGTH('Agencies', 'BrandSecondaryColor') IS NULL
                    ALTER TABLE [Agencies] ADD [BrandSecondaryColor] nvarchar(20) NULL;
                IF COL_LENGTH('Agencies', 'BrandTextColor') IS NULL
                    ALTER TABLE [Agencies] ADD [BrandTextColor] nvarchar(20) NULL;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_Profile_Unique' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
                    CREATE UNIQUE INDEX [IX_AgencyProfiles_Profile_Unique] ON [AgencyProfiles] ([ProfileType], [ProfileId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_Agency_Profile_Unique' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
                    CREATE UNIQUE INDEX [IX_AgencyProfiles_Agency_Profile_Unique] ON [AgencyProfiles] ([AgencyId], [ProfileType], [ProfileId]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyContents_Agency_Content_Unique' AND object_id = OBJECT_ID(N'[AgencyContents]'))
                    CREATE UNIQUE INDEX [IX_AgencyContents_Agency_Content_Unique] ON [AgencyContents] ([AgencyId], [ContentType], [ContentId]);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AgencyContents");
            migrationBuilder.DropTable(name: "AgencyProfiles");
            migrationBuilder.DropTable(name: "Agencies");
        }
    }
}
