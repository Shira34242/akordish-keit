using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddArticlesAndNewsManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Articles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FeaturedImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PublishDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AuthorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Category = table.Column<int>(type: "int", nullable: false),
                    ContentType = table.Column<int>(type: "int", nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CanonicalUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VideoEmbedUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AudioEmbedUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImageCredit = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ShortDescription = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsFeatured = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ScheduledDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsPremium = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    MetaTitle = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    MetaDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OpenGraphImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ViewCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    LikeCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    ReadTimeMinutes = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Articles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ArticleGalleryImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArticleId = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Caption = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleGalleryImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArticleGalleryImages_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ArticleTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArticleId = table.Column<int>(type: "int", nullable: false),
                    TagId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleTags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArticleTags_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ArticleTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleGalleryImages_ArticleId",
                table: "ArticleGalleryImages",
                column: "ArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_ArticleGalleryImages_ArticleId_DisplayOrder",
                table: "ArticleGalleryImages",
                columns: new[] { "ArticleId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_Category_Status_PublishDate",
                table: "Articles",
                columns: new[] { "Category", "Status", "PublishDate" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_ContentType_PublishDate",
                table: "Articles",
                columns: new[] { "ContentType", "PublishDate" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_IsDeleted",
                table: "Articles",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_IsFeatured_DisplayOrder",
                table: "Articles",
                columns: new[] { "IsFeatured", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_IsFeatured_PublishDate",
                table: "Articles",
                columns: new[] { "IsFeatured", "PublishDate" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_Articles_Slug",
                table: "Articles",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ArticleTags_ArticleId_TagId",
                table: "ArticleTags",
                columns: new[] { "ArticleId", "TagId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ArticleTags_TagId",
                table: "ArticleTags",
                column: "TagId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArticleGalleryImages");

            migrationBuilder.DropTable(
                name: "ArticleTags");

            migrationBuilder.DropTable(
                name: "Articles");
        }
    }
}
