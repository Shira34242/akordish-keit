using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceProvidersAndTeachers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Users",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServiceProviderCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    EnglishName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IconUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceProviderCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServiceProviders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProfileImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ShortBio = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FullDescription = table.Column<string>(type: "nvarchar(max)", maxLength: 5000, nullable: true),
                    IsTeacher = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Location = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    YearsOfExperience = table.Column<int>(type: "int", nullable: true),
                    WorkingHours = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    WhatsAppNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    WebsiteUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VideoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsFeatured = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceProviders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceProviders_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceProviderCategoryMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceProviderId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    SubCategory = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceProviderCategoryMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceProviderCategoryMappings_ServiceProviderCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ServiceProviderCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceProviderCategoryMappings_ServiceProviders_ServiceProviderId",
                        column: x => x.ServiceProviderId,
                        principalTable: "ServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceProviderGalleryImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceProviderId = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Caption = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Order = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceProviderGalleryImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceProviderGalleryImages_ServiceProviders_ServiceProviderId",
                        column: x => x.ServiceProviderId,
                        principalTable: "ServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Teachers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    PriceList = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Languages = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TargetAudience = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Availability = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Education = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LessonTypes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Specializations = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teachers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Teachers_ServiceProviders_Id",
                        column: x => x.Id,
                        principalTable: "ServiceProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeacherInstruments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TeacherId = table.Column<int>(type: "int", nullable: false),
                    InstrumentId = table.Column<int>(type: "int", nullable: false),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeacherInstruments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeacherInstruments_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeacherInstruments_Teachers_TeacherId",
                        column: x => x.TeacherId,
                        principalTable: "Teachers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategories_IsActive",
                table: "ServiceProviderCategories",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategories_Name",
                table: "ServiceProviderCategories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategories_Order",
                table: "ServiceProviderCategories",
                column: "Order");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategoryMappings_CategoryId",
                table: "ServiceProviderCategoryMappings",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategoryMappings_ServiceProviderId",
                table: "ServiceProviderCategoryMappings",
                column: "ServiceProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderCategoryMappings_ServiceProviderId_CategoryId",
                table: "ServiceProviderCategoryMappings",
                columns: new[] { "ServiceProviderId", "CategoryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderGalleryImages_Order",
                table: "ServiceProviderGalleryImages",
                column: "Order");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviderGalleryImages_ServiceProviderId",
                table: "ServiceProviderGalleryImages",
                column: "ServiceProviderId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_IsDeleted",
                table: "ServiceProviders",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_IsFeatured",
                table: "ServiceProviders",
                column: "IsFeatured");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_IsTeacher",
                table: "ServiceProviders",
                column: "IsTeacher");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_Status",
                table: "ServiceProviders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceProviders_UserId",
                table: "ServiceProviders",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeacherInstruments_InstrumentId",
                table: "TeacherInstruments",
                column: "InstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherInstruments_IsPrimary",
                table: "TeacherInstruments",
                column: "IsPrimary");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherInstruments_TeacherId",
                table: "TeacherInstruments",
                column: "TeacherId");

            migrationBuilder.CreateIndex(
                name: "IX_TeacherInstruments_TeacherId_InstrumentId",
                table: "TeacherInstruments",
                columns: new[] { "TeacherId", "InstrumentId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceProviderCategoryMappings");

            migrationBuilder.DropTable(
                name: "ServiceProviderGalleryImages");

            migrationBuilder.DropTable(
                name: "TeacherInstruments");

            migrationBuilder.DropTable(
                name: "ServiceProviderCategories");

            migrationBuilder.DropTable(
                name: "Teachers");

            migrationBuilder.DropTable(
                name: "ServiceProviders");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Users");
        }
    }
}
