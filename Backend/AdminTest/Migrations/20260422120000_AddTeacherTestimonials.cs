using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AkordishKeit.Migrations
{
    [DbContext(typeof(AkordishKeitDbContext))]
    [Migration("20260422120000_AddTeacherTestimonials")]
    public partial class AddTeacherTestimonials : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create table only if it doesn't already exist
            // (SyncPendingChanges migration may have created it first on existing DBs)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TeacherTestimonials' AND schema_id = SCHEMA_ID('dbo'))
                BEGIN
                    CREATE TABLE [TeacherTestimonials] (
                        [Id] int NOT NULL IDENTITY,
                        [TeacherId] int NOT NULL,
                        [StudentName] nvarchar(120) NULL,
                        [Text] nvarchar(1000) NOT NULL,
                        [Order] int NOT NULL,
                        CONSTRAINT [PK_TeacherTestimonials] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_TeacherTestimonials_Teachers_TeacherId] FOREIGN KEY ([TeacherId]) REFERENCES [Teachers] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_TeacherTestimonials_TeacherId] ON [TeacherTestimonials] ([TeacherId]);
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TeacherTestimonials_TeacherId_Order' AND object_id = OBJECT_ID('dbo.TeacherTestimonials'))
                BEGIN
                    CREATE INDEX [IX_TeacherTestimonials_TeacherId_Order] ON [TeacherTestimonials] ([TeacherId], [Order]);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TeacherTestimonials_TeacherId_Order' AND object_id = OBJECT_ID('dbo.TeacherTestimonials'))
                    DROP INDEX [IX_TeacherTestimonials_TeacherId_Order] ON [TeacherTestimonials];

                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TeacherTestimonials' AND schema_id = SCHEMA_ID('dbo'))
                    DROP TABLE [TeacherTestimonials];
            ");
        }
    }
}
