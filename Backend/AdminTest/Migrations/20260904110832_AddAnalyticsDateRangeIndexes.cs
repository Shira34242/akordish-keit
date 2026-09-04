using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalyticsDateRangeIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_SongViews_ViewedAt",
                table: "SongViews",
                column: "ViewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PodcastEpisodeViews_ViewedAt",
                table: "PodcastEpisodeViews",
                column: "ViewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_EventViews_ViewedAt",
                table: "EventViews",
                column: "ViewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ButtonClicks_ButtonType_ClickedAt",
                table: "ButtonClicks",
                columns: new[] { "ButtonType", "ClickedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleViews_ViewedAt",
                table: "ArticleViews",
                column: "ViewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignViews_ViewedAt",
                table: "AdCampaignViews",
                column: "ViewedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AdCampaignClicks_ClickedAt",
                table: "AdCampaignClicks",
                column: "ClickedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SongViews_ViewedAt",
                table: "SongViews");

            migrationBuilder.DropIndex(
                name: "IX_PodcastEpisodeViews_ViewedAt",
                table: "PodcastEpisodeViews");

            migrationBuilder.DropIndex(
                name: "IX_EventViews_ViewedAt",
                table: "EventViews");

            migrationBuilder.DropIndex(
                name: "IX_ButtonClicks_ButtonType_ClickedAt",
                table: "ButtonClicks");

            migrationBuilder.DropIndex(
                name: "IX_ArticleViews_ViewedAt",
                table: "ArticleViews");

            migrationBuilder.DropIndex(
                name: "IX_AdCampaignViews_ViewedAt",
                table: "AdCampaignViews");

            migrationBuilder.DropIndex(
                name: "IX_AdCampaignClicks_ClickedAt",
                table: "AdCampaignClicks");
        }
    }
}
