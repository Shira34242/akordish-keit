using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class RenameServiceProviderTablesToMusic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceProviderCategoryMappings_ServiceProviderCategories_CategoryId",
                table: "ServiceProviderCategoryMappings");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceProviderCategoryMappings_ServiceProviders_ServiceProviderId",
                table: "ServiceProviderCategoryMappings");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceProviderGalleryImages_ServiceProviders_ServiceProviderId",
                table: "ServiceProviderGalleryImages");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceProviders_Users_UserId",
                table: "ServiceProviders");

            migrationBuilder.DropForeignKey(
                name: "FK_Teachers_ServiceProviders_Id",
                table: "Teachers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServiceProviders",
                table: "ServiceProviders");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServiceProviderGalleryImages",
                table: "ServiceProviderGalleryImages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServiceProviderCategoryMappings",
                table: "ServiceProviderCategoryMappings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ServiceProviderCategories",
                table: "ServiceProviderCategories");

            migrationBuilder.RenameTable(
                name: "ServiceProviders",
                newName: "MusicServiceProviders");

            migrationBuilder.RenameTable(
                name: "ServiceProviderGalleryImages",
                newName: "MusicServiceProviderGalleryImages");

            migrationBuilder.RenameTable(
                name: "ServiceProviderCategoryMappings",
                newName: "MusicServiceProviderCategoryMappings");

            migrationBuilder.RenameTable(
                name: "ServiceProviderCategories",
                newName: "MusicServiceProviderCategories");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviders_UserId",
                table: "MusicServiceProviders",
                newName: "IX_MusicServiceProviders_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviders_Status",
                table: "MusicServiceProviders",
                newName: "IX_MusicServiceProviders_Status");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviders_IsTeacher",
                table: "MusicServiceProviders",
                newName: "IX_MusicServiceProviders_IsTeacher");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviders_IsFeatured",
                table: "MusicServiceProviders",
                newName: "IX_MusicServiceProviders_IsFeatured");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviders_IsDeleted",
                table: "MusicServiceProviders",
                newName: "IX_MusicServiceProviders_IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderGalleryImages_ServiceProviderId",
                table: "MusicServiceProviderGalleryImages",
                newName: "IX_MusicServiceProviderGalleryImages_ServiceProviderId");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderGalleryImages_Order",
                table: "MusicServiceProviderGalleryImages",
                newName: "IX_MusicServiceProviderGalleryImages_Order");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategoryMappings_ServiceProviderId_CategoryId",
                table: "MusicServiceProviderCategoryMappings",
                newName: "IX_MusicServiceProviderCategoryMappings_ServiceProviderId_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategoryMappings_ServiceProviderId",
                table: "MusicServiceProviderCategoryMappings",
                newName: "IX_MusicServiceProviderCategoryMappings_ServiceProviderId");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategoryMappings_CategoryId",
                table: "MusicServiceProviderCategoryMappings",
                newName: "IX_MusicServiceProviderCategoryMappings_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategories_Order",
                table: "MusicServiceProviderCategories",
                newName: "IX_MusicServiceProviderCategories_Order");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategories_Name",
                table: "MusicServiceProviderCategories",
                newName: "IX_MusicServiceProviderCategories_Name");

            migrationBuilder.RenameIndex(
                name: "IX_ServiceProviderCategories_IsActive",
                table: "MusicServiceProviderCategories",
                newName: "IX_MusicServiceProviderCategories_IsActive");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MusicServiceProviders",
                table: "MusicServiceProviders",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MusicServiceProviderGalleryImages",
                table: "MusicServiceProviderGalleryImages",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MusicServiceProviderCategoryMappings",
                table: "MusicServiceProviderCategoryMappings",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_MusicServiceProviderCategories",
                table: "MusicServiceProviderCategories",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviderCategoryMappings_MusicServiceProviderCategories_CategoryId",
                table: "MusicServiceProviderCategoryMappings",
                column: "CategoryId",
                principalTable: "MusicServiceProviderCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviderCategoryMappings_MusicServiceProviders_ServiceProviderId",
                table: "MusicServiceProviderCategoryMappings",
                column: "ServiceProviderId",
                principalTable: "MusicServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviderGalleryImages_MusicServiceProviders_ServiceProviderId",
                table: "MusicServiceProviderGalleryImages",
                column: "ServiceProviderId",
                principalTable: "MusicServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MusicServiceProviders_Users_UserId",
                table: "MusicServiceProviders",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Teachers_MusicServiceProviders_Id",
                table: "Teachers",
                column: "Id",
                principalTable: "MusicServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviderCategoryMappings_MusicServiceProviderCategories_CategoryId",
                table: "MusicServiceProviderCategoryMappings");

            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviderCategoryMappings_MusicServiceProviders_ServiceProviderId",
                table: "MusicServiceProviderCategoryMappings");

            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviderGalleryImages_MusicServiceProviders_ServiceProviderId",
                table: "MusicServiceProviderGalleryImages");

            migrationBuilder.DropForeignKey(
                name: "FK_MusicServiceProviders_Users_UserId",
                table: "MusicServiceProviders");

            migrationBuilder.DropForeignKey(
                name: "FK_Teachers_MusicServiceProviders_Id",
                table: "Teachers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MusicServiceProviders",
                table: "MusicServiceProviders");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MusicServiceProviderGalleryImages",
                table: "MusicServiceProviderGalleryImages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MusicServiceProviderCategoryMappings",
                table: "MusicServiceProviderCategoryMappings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_MusicServiceProviderCategories",
                table: "MusicServiceProviderCategories");

            migrationBuilder.RenameTable(
                name: "MusicServiceProviders",
                newName: "ServiceProviders");

            migrationBuilder.RenameTable(
                name: "MusicServiceProviderGalleryImages",
                newName: "ServiceProviderGalleryImages");

            migrationBuilder.RenameTable(
                name: "MusicServiceProviderCategoryMappings",
                newName: "ServiceProviderCategoryMappings");

            migrationBuilder.RenameTable(
                name: "MusicServiceProviderCategories",
                newName: "ServiceProviderCategories");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviders_UserId",
                table: "ServiceProviders",
                newName: "IX_ServiceProviders_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviders_Status",
                table: "ServiceProviders",
                newName: "IX_ServiceProviders_Status");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviders_IsTeacher",
                table: "ServiceProviders",
                newName: "IX_ServiceProviders_IsTeacher");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviders_IsFeatured",
                table: "ServiceProviders",
                newName: "IX_ServiceProviders_IsFeatured");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviders_IsDeleted",
                table: "ServiceProviders",
                newName: "IX_ServiceProviders_IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderGalleryImages_ServiceProviderId",
                table: "ServiceProviderGalleryImages",
                newName: "IX_ServiceProviderGalleryImages_ServiceProviderId");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderGalleryImages_Order",
                table: "ServiceProviderGalleryImages",
                newName: "IX_ServiceProviderGalleryImages_Order");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategoryMappings_ServiceProviderId_CategoryId",
                table: "ServiceProviderCategoryMappings",
                newName: "IX_ServiceProviderCategoryMappings_ServiceProviderId_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategoryMappings_ServiceProviderId",
                table: "ServiceProviderCategoryMappings",
                newName: "IX_ServiceProviderCategoryMappings_ServiceProviderId");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategoryMappings_CategoryId",
                table: "ServiceProviderCategoryMappings",
                newName: "IX_ServiceProviderCategoryMappings_CategoryId");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategories_Order",
                table: "ServiceProviderCategories",
                newName: "IX_ServiceProviderCategories_Order");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategories_Name",
                table: "ServiceProviderCategories",
                newName: "IX_ServiceProviderCategories_Name");

            migrationBuilder.RenameIndex(
                name: "IX_MusicServiceProviderCategories_IsActive",
                table: "ServiceProviderCategories",
                newName: "IX_ServiceProviderCategories_IsActive");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServiceProviders",
                table: "ServiceProviders",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServiceProviderGalleryImages",
                table: "ServiceProviderGalleryImages",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServiceProviderCategoryMappings",
                table: "ServiceProviderCategoryMappings",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ServiceProviderCategories",
                table: "ServiceProviderCategories",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceProviderCategoryMappings_ServiceProviderCategories_CategoryId",
                table: "ServiceProviderCategoryMappings",
                column: "CategoryId",
                principalTable: "ServiceProviderCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceProviderCategoryMappings_ServiceProviders_ServiceProviderId",
                table: "ServiceProviderCategoryMappings",
                column: "ServiceProviderId",
                principalTable: "ServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceProviderGalleryImages_ServiceProviders_ServiceProviderId",
                table: "ServiceProviderGalleryImages",
                column: "ServiceProviderId",
                principalTable: "ServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceProviders_Users_UserId",
                table: "ServiceProviders",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Teachers_ServiceProviders_Id",
                table: "Teachers",
                column: "Id",
                principalTable: "ServiceProviders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
