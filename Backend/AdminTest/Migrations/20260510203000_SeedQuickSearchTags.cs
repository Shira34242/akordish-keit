using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260510203000_SeedQuickSearchTags")]
    public partial class SeedQuickSearchTags : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 1, [ChordQuickSearchOrder] = 2 WHERE [Id] = 2");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 1, [ChordQuickSearchOrder] = 3 WHERE [Id] = 3");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 1, [ChordQuickSearchOrder] = 4 WHERE [Id] = 16");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 1, [ChordQuickSearchOrder] = 5 WHERE [Id] = 18");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 0, [ChordQuickSearchOrder] = 0 WHERE [Id] = 2");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 0, [ChordQuickSearchOrder] = 0 WHERE [Id] = 3");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 0, [ChordQuickSearchOrder] = 0 WHERE [Id] = 16");
            migrationBuilder.Sql("UPDATE [Tags] SET [ShowInChordQuickSearch] = 0, [ChordQuickSearchOrder] = 0 WHERE [Id] = 18");
        }
    }
}
