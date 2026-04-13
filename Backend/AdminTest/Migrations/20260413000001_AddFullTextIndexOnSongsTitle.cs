using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddFullTextIndexOnSongsTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CREATE FULLTEXT CATALOG cannot run inside a transaction — suppressTransaction: true
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'SongCatalog')
                    CREATE FULLTEXT CATALOG SongCatalog AS DEFAULT;
            ", suppressTransaction: true);

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('Songs'))
                    CREATE FULLTEXT INDEX ON [Songs]([Title]) KEY INDEX [PK_Songs] ON SongCatalog;
            ", suppressTransaction: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('Songs'))
                    DROP FULLTEXT INDEX ON [Songs];
            ", suppressTransaction: true);

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'SongCatalog')
                    DROP FULLTEXT CATALOG SongCatalog;
            ", suppressTransaction: true);
        }
    }
}
