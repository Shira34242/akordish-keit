using AkordishKeit.Authorization;
using AkordishKeit.Data;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Serialize enums as numbers for frontend filtering
        // Note: If you need specific enums as strings, use [JsonConverter] attribute on those properties
        options.JsonSerializerOptions.Converters.Clear();
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<IYouTubeService, YouTubeService>();

// Add Memory Cache (לשימוש ב-SystemSettingsService)
builder.Services.AddMemoryCache();

// Add Services
builder.Services.AddScoped<ISystemSettingsService, SystemSettingsService>();
builder.Services.AddScoped<IUserTagService, UserTagService>();
builder.Services.AddScoped<IArticleService, ArticleService>();
builder.Services.AddScoped<ISongService, SongService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IFeaturedContentService, FeaturedContentService>();
builder.Services.AddScoped<IMusicServiceProviderService, MusicServiceProviderService>();
builder.Services.AddScoped<ITeacherService, TeacherService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<ILikedContentService, LikedContentService>();
builder.Services.AddScoped<IUserKnownChordService, UserKnownChordService>();
builder.Services.AddScoped<IChordIndexService, ChordIndexService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IBoostService, BoostService>();
builder.Services.AddScoped<INewsPageSectionService, NewsPageSectionService>();
builder.Services.AddScoped<INotificationService, NotificationService>();

// 🔐 Security Services
builder.Services.AddSingleton<ICsrfTokenService, CsrfTokenService>();

// Add Background Services
builder.Services.AddHostedService<CleanupService>();

// Add DbContext
builder.Services.AddDbContext<AkordishKeitDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
    };

    // 🔐 קריאת JWT Token מ-Cookie במקום מ-Authorization Header
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // מנסה לקרוא מ-Cookie קודם
            context.Token = context.Request.Cookies["auth-token"];

            // אם אין cookie, מנסה לקרוא מ-Authorization header (לתמיכה לאחור)
            if (string.IsNullOrEmpty(context.Token))
            {
                var authHeader = context.Request.Headers["Authorization"].ToString();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                {
                    context.Token = authHeader.Substring("Bearer ".Length).Trim();
                }
            }

            return Task.CompletedTask;
        }
    };
});

// Add Authorization with custom policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SubscribedTier", policy =>
        policy.Requirements.Add(new SubscribedTierRequirement()));
});

// Register Authorization Handlers
builder.Services.AddScoped<IAuthorizationHandler, SubscribedTierHandler>();

// Add CORS for Angular
// ⚠️ חשוב! AllowCredentials() מאפשר שליחת cookies בין domains
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular",
        policy =>
        {
            policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials(); // 🔐 מאפשר cookies ו-authentication credentials
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AkordishKeitDbContext>();
    var pendingMigrations = dbContext.Database.GetPendingMigrations().ToList();
    const string fullTextMigrationId = "20260413000001_AddFullTextIndexOnSongsTitle";

    if (pendingMigrations.Count > 0)
    {
        var migrationsBeforeFullText = pendingMigrations
            .Where(migrationId => string.CompareOrdinal(migrationId, fullTextMigrationId) < 0)
            .ToList();

        if (migrationsBeforeFullText.Count > 0)
        {
            dbContext.Database.Migrate(migrationsBeforeFullText.Last());
        }
        else if (!pendingMigrations.Contains(fullTextMigrationId))
        {
            dbContext.Database.Migrate();
        }
    }

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Playlists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Playlists]', N'IsDefault') IS NULL
        BEGIN
            ALTER TABLE [Playlists]
            ADD [IsDefault] bit NOT NULL CONSTRAINT [DF_Playlists_IsDefault] DEFAULT 0;
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Notifications]', N'U') IS NULL
        BEGIN
            CREATE TABLE [Notifications] (
                [Id] int NOT NULL IDENTITY,
                [UserId] int NOT NULL,
                [Title] nvarchar(160) NOT NULL,
                [Message] nvarchar(1000) NOT NULL,
                [Type] int NOT NULL,
                [Category] int NOT NULL,
                [RelatedEntityType] nvarchar(80) NULL,
                [RelatedEntityId] int NULL,
                [ActionUrl] nvarchar(500) NULL,
                [MediaUrl] nvarchar(1000) NULL,
                [MediaType] nvarchar(40) NULL,
                [MediaThumbnailUrl] nvarchar(1000) NULL,
                [MediaAltText] nvarchar(200) NULL,
                [MediaDisplaySize] nvarchar(20) NULL,
                [AttachmentsJson] nvarchar(max) NULL,
                [CampaignName] nvarchar(160) NULL,
                [AudienceLabel] nvarchar(300) NULL,
                [IsRead] bit NOT NULL CONSTRAINT [DF_Notifications_IsRead] DEFAULT CAST(0 AS bit),
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Notifications_CreatedAt] DEFAULT (GETUTCDATE()),
                [ReadAt] datetime2 NULL,
                [CreatedByUserId] int NULL,
                [IsDeleted] bit NOT NULL CONSTRAINT [DF_Notifications_IsDeleted] DEFAULT CAST(0 AS bit),
                [DeletedAt] datetime2 NULL,
                CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_Notifications_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION,
                CONSTRAINT [FK_Notifications_Users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END

        IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH(N'[Notifications]', N'MediaUrl') IS NULL
                ALTER TABLE [Notifications] ADD [MediaUrl] nvarchar(1000) NULL;

            IF COL_LENGTH(N'[Notifications]', N'MediaType') IS NULL
                ALTER TABLE [Notifications] ADD [MediaType] nvarchar(40) NULL;

            IF COL_LENGTH(N'[Notifications]', N'MediaThumbnailUrl') IS NULL
                ALTER TABLE [Notifications] ADD [MediaThumbnailUrl] nvarchar(1000) NULL;

            IF COL_LENGTH(N'[Notifications]', N'MediaAltText') IS NULL
                ALTER TABLE [Notifications] ADD [MediaAltText] nvarchar(200) NULL;

            IF COL_LENGTH(N'[Notifications]', N'MediaDisplaySize') IS NULL
                ALTER TABLE [Notifications] ADD [MediaDisplaySize] nvarchar(20) NULL;

            IF COL_LENGTH(N'[Notifications]', N'AttachmentsJson') IS NULL
                ALTER TABLE [Notifications] ADD [AttachmentsJson] nvarchar(max) NULL;

            IF COL_LENGTH(N'[Notifications]', N'CampaignName') IS NULL
                ALTER TABLE [Notifications] ADD [CampaignName] nvarchar(160) NULL;

            IF COL_LENGTH(N'[Notifications]', N'AudienceLabel') IS NULL
                ALTER TABLE [Notifications] ADD [AudienceLabel] nvarchar(300) NULL;
        END

        IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_CreatedByUserId' AND object_id = OBJECT_ID(N'[Notifications]'))
        BEGIN
            CREATE INDEX [IX_Notifications_CreatedByUserId] ON [Notifications] ([CreatedByUserId]);
        END

        IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_RelatedEntity' AND object_id = OBJECT_ID(N'[Notifications]'))
        BEGIN
            CREATE INDEX [IX_Notifications_RelatedEntity] ON [Notifications] ([RelatedEntityType], [RelatedEntityId]);
        END

        IF OBJECT_ID(N'[Notifications]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_User_Read_Deleted_Created' AND object_id = OBJECT_ID(N'[Notifications]'))
        BEGIN
            CREATE INDEX [IX_Notifications_User_Read_Deleted_Created] ON [Notifications] ([UserId], [IsRead], [IsDeleted], [CreatedAt]);
        END

        IF OBJECT_ID(N'[NotificationGroups]', N'U') IS NULL
        BEGIN
            CREATE TABLE [NotificationGroups] (
                [Id] int NOT NULL IDENTITY,
                [Name] nvarchar(160) NOT NULL,
                [Description] nvarchar(500) NULL,
                [ImageUrl] nvarchar(1000) NULL,
                [SendToAll] bit NOT NULL CONSTRAINT [DF_NotificationGroups_SendToAll] DEFAULT CAST(0 AS bit),
                [Role] int NULL,
                [IsActive] bit NULL,
                [ContentTag] int NULL,
                [PreferredInstrumentId] int NULL,
                [JoinedFrom] datetime2 NULL,
                [JoinedTo] datetime2 NULL,
                [AddressContains] nvarchar(200) NULL,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_NotificationGroups_CreatedAt] DEFAULT (GETUTCDATE()),
                [UpdatedAt] datetime2 NULL,
                [IsDeleted] bit NOT NULL CONSTRAINT [DF_NotificationGroups_IsDeleted] DEFAULT CAST(0 AS bit),
                [CreatedByUserId] int NOT NULL,
                CONSTRAINT [PK_NotificationGroups] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_NotificationGroups_Users_CreatedByUserId] FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END

        IF OBJECT_ID(N'[NotificationGroups]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NotificationGroups_Deleted_Created' AND object_id = OBJECT_ID(N'[NotificationGroups]'))
        BEGIN
            CREATE INDEX [IX_NotificationGroups_Deleted_Created] ON [NotificationGroups] ([IsDeleted], [CreatedAt]);
        END

        IF OBJECT_ID(N'[NotificationGroupMembers]', N'U') IS NULL
        BEGIN
            CREATE TABLE [NotificationGroupMembers] (
                [NotificationGroupId] int NOT NULL,
                [UserId] int NOT NULL,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_NotificationGroupMembers_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_NotificationGroupMembers] PRIMARY KEY ([NotificationGroupId], [UserId]),
                CONSTRAINT [FK_NotificationGroupMembers_NotificationGroups_NotificationGroupId] FOREIGN KEY ([NotificationGroupId]) REFERENCES [NotificationGroups] ([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_NotificationGroupMembers_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END

        IF OBJECT_ID(N'[NotificationGroupMembers]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NotificationGroupMembers_UserId' AND object_id = OBJECT_ID(N'[NotificationGroupMembers]'))
        BEGIN
            CREATE INDEX [IX_NotificationGroupMembers_UserId] ON [NotificationGroupMembers] ([UserId]);
        END
    ");
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngular");

// Enable static files for uploaded media
app.UseStaticFiles();

// ����! Authentication ���� Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.Run();
