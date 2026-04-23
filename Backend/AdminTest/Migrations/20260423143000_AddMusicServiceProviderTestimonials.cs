using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260423143000_AddMusicServiceProviderTestimonials")]
    public partial class AddMusicServiceProviderTestimonials : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MusicServiceProviderTestimonials' AND schema_id = SCHEMA_ID('dbo'))
                BEGIN
                    CREATE TABLE [MusicServiceProviderTestimonials] (
                        [Id] int NOT NULL IDENTITY,
                        [ServiceProviderId] int NOT NULL,
                        [ClientName] nvarchar(120) NULL,
                        [Text] nvarchar(1000) NOT NULL,
                        [Order] int NOT NULL,
                        CONSTRAINT [PK_MusicServiceProviderTestimonials] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_MusicServiceProviderTestimonials_MusicServiceProviders_ServiceProviderId] FOREIGN KEY ([ServiceProviderId]) REFERENCES [MusicServiceProviders] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_MusicServiceProviderTestimonials_ServiceProviderId] ON [MusicServiceProviderTestimonials] ([ServiceProviderId]);
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MusicServiceProviderTestimonials_ServiceProviderId_Order' AND object_id = OBJECT_ID('dbo.MusicServiceProviderTestimonials'))
                BEGIN
                    CREATE INDEX [IX_MusicServiceProviderTestimonials_ServiceProviderId_Order] ON [MusicServiceProviderTestimonials] ([ServiceProviderId], [Order]);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MusicServiceProviderTestimonials_ServiceProviderId_Order' AND object_id = OBJECT_ID('dbo.MusicServiceProviderTestimonials'))
                    DROP INDEX [IX_MusicServiceProviderTestimonials_ServiceProviderId_Order] ON [MusicServiceProviderTestimonials];

                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'MusicServiceProviderTestimonials' AND schema_id = SCHEMA_ID('dbo'))
                    DROP TABLE [MusicServiceProviderTestimonials];
            ");
        }
    }
}
