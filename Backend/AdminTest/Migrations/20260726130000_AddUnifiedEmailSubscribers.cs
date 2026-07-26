using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations;

[DbContext(typeof(AkordishKeitDbContext))]
[Migration("20260726130000_AddUnifiedEmailSubscribers")]
public partial class AddUnifiedEmailSubscribers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "EmailSubscribers",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                UserId = table.Column<int>(type: "int", nullable: true),
                IsSubscribed = table.Column<bool>(type: "bit", nullable: false),
                Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                SubscribedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UnsubscribedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EmailSubscribers", x => x.Id);
                table.ForeignKey(
                    name: "FK_EmailSubscribers_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "IX_EmailSubscribers_Email",
            table: "EmailSubscribers",
            column: "Email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_EmailSubscribers_UserId",
            table: "EmailSubscribers",
            column: "UserId",
            unique: true,
            filter: "[UserId] IS NOT NULL");

        migrationBuilder.CreateTable(
            name: "EmailSubscriberGroups",
            columns: table => new
            {
                EmailGroupId = table.Column<int>(type: "int", nullable: false),
                SubscriberId = table.Column<int>(type: "int", nullable: false),
                AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EmailSubscriberGroups", x => new { x.EmailGroupId, x.SubscriberId });
                table.ForeignKey(
                    name: "FK_EmailSubscriberGroups_EmailGroups_EmailGroupId",
                    column: x => x.EmailGroupId,
                    principalTable: "EmailGroups",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_EmailSubscriberGroups_EmailSubscribers_SubscriberId",
                    column: x => x.SubscriberId,
                    principalTable: "EmailSubscribers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_EmailSubscriberGroups_SubscriberId",
            table: "EmailSubscriberGroups",
            column: "SubscriberId");

        migrationBuilder.Sql("""
            INSERT INTO [EmailSubscribers]
                ([Email], [Name], [UserId], [IsSubscribed], [Source], [SubscribedAt], [UnsubscribedAt], [CreatedAt], [UpdatedAt])
            SELECT LOWER(LTRIM(RTRIM(u.[Email]))), u.[Username], u.[Id],
                CASE WHEN u.[MarketingConsent] = 1 AND mu.[Id] IS NULL THEN 1 ELSE 0 END,
                COALESCE(NULLIF(u.[MarketingConsentSource], ''), 'user'),
                COALESCE(u.[MarketingConsentAt], u.[CreatedAt]),
                CASE WHEN u.[MarketingConsent] = 0 OR mu.[Id] IS NOT NULL
                    THEN COALESCE(u.[MarketingConsentRevokedAt], mu.[UnsubscribedAt]) ELSE NULL END,
                u.[CreatedAt], u.[UpdatedAt]
            FROM [Users] u
            LEFT JOIN [MarketingUnsubscribes] mu ON mu.[Email] = LOWER(LTRIM(RTRIM(u.[Email])))
            WHERE u.[IsDeleted] = 0 AND LTRIM(RTRIM(u.[Email])) <> '';

            INSERT INTO [EmailSubscribers]
                ([Email], [Name], [UserId], [IsSubscribed], [Source], [SubscribedAt], [UnsubscribedAt], [CreatedAt], [UpdatedAt])
            SELECT LOWER(LTRIM(RTRIM(si.[Email]))), NULL, NULL,
                CASE WHEN mu.[Id] IS NULL THEN 1 ELSE 0 END,
                COALESCE(NULLIF(si.[Source], ''), 'site-interest'), si.[CreatedAt], mu.[UnsubscribedAt], si.[CreatedAt], NULL
            FROM [SiteInterestRegistrations] si
            LEFT JOIN [MarketingUnsubscribes] mu ON mu.[Email] = LOWER(LTRIM(RTRIM(si.[Email])))
            WHERE NOT EXISTS (
                SELECT 1 FROM [EmailSubscribers] es
                WHERE es.[Email] = LOWER(LTRIM(RTRIM(si.[Email])))
            );

            INSERT INTO [MarketingUnsubscribes] ([Email], [UnsubscribedAt], [Source])
            SELECT es.[Email], COALESCE(es.[UnsubscribedAt], GETUTCDATE()), 'migration'
            FROM [EmailSubscribers] es
            WHERE es.[IsSubscribed] = 0
              AND NOT EXISTS (SELECT 1 FROM [MarketingUnsubscribes] mu WHERE mu.[Email] = es.[Email]);

            IF OBJECT_ID(N'[EmailGroupMembers]', N'U') IS NOT NULL
            BEGIN
                INSERT INTO [EmailSubscriberGroups] ([EmailGroupId], [SubscriberId], [AddedAt])
                SELECT egm.[EmailGroupId], es.[Id], egm.[AddedAt]
                FROM [EmailGroupMembers] egm
                INNER JOIN [EmailSubscribers] es ON es.[UserId] = egm.[UserId];
            END
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "EmailSubscriberGroups");
        migrationBuilder.DropTable(name: "EmailSubscribers");
    }
}
