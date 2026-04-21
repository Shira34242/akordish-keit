using System;
using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260421120000_AddUserKnownChords")]
    public partial class AddUserKnownChords : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserKnownChords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Instrument = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ChordName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    NormalizedChordName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserKnownChords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserKnownChords_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserKnownChords_User_Instrument_AddedAt",
                table: "UserKnownChords",
                columns: new[] { "UserId", "Instrument", "AddedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserKnownChords_User_Instrument_Chord",
                table: "UserKnownChords",
                columns: new[] { "UserId", "Instrument", "NormalizedChordName" },
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserKnownChords");
        }
    }
}
