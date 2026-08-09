using AkordishKeit.Authorization;
using AkordishKeit.Data;
using AkordishKeit.Middleware;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.ApplicationInsights.TelemetryConverters;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) =>
{
    config
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .WriteTo.Console(
            outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
        .WriteTo.File(
            path: "logs/akordishkeit-.log",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 31,
            outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}"
        );

    var aiConnectionString = context.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
    if (!string.IsNullOrEmpty(aiConnectionString))
    {
        config.WriteTo.ApplicationInsights(aiConnectionString, TelemetryConverter.Traces);
    }
});

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(type =>
    {
        if (!type.IsGenericType) return type.Name;
        var baseName = type.GetGenericTypeDefinition().Name.Split('`')[0];
        var args = string.Join("", type.GetGenericArguments().Select(t => t.Name));
        return $"{baseName}Of{args}";
    });
});
builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<IYouTubeService, YouTubeService>();
builder.Services.AddHttpClient<IExternalImageStorageService, ExternalImageStorageService>();
builder.Services.AddHttpContextAccessor();

// Add Memory Cache (לשימוש ב-SystemSettingsService)
builder.Services.AddMemoryCache();

// Rate limiting — autocomplete: 40/min, songs endpoint: 60/min per IP
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("analytics-tracking", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 240,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
    options.AddFixedWindowLimiter("autocomplete", limiterOptions =>
    {
        limiterOptions.PermitLimit = 40;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("songs", limiterOptions =>
    {
        limiterOptions.PermitLimit = 60;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Add Services
builder.Services.AddScoped<ISystemSettingsService, SystemSettingsService>();
builder.Services.AddScoped<IUserTagService, UserTagService>();
builder.Services.AddScoped<IArticleService, ArticleService>();
builder.Services.AddScoped<ISongService, SongService>();
builder.Services.AddHttpClient<ISmartSongImportService, SmartSongImportService>();
builder.Services.AddHttpClient<ISmartContentImportService, SmartContentImportService>();
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
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IBoostService, BoostService>();
builder.Services.AddScoped<IContentPromotionService, ContentPromotionService>();
builder.Services.AddScoped<IDisplayRankingService, DisplayRankingService>();
builder.Services.AddScoped<IReferralService, ReferralService>();
builder.Services.AddScoped<INewsPageSectionService, NewsPageSectionService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IEmailV2Service, EmailV2Service>();
builder.Services.AddScoped<IAgencyService, AgencyService>();
builder.Services.AddScoped<IPodcastService, PodcastService>();
builder.Services.AddScoped<IArtistSuggestionService, ArtistSuggestionService>();

// 🔐 Security Services
builder.Services.AddSingleton<ICsrfTokenService, CsrfTokenService>();

// Email Pipeline
builder.Services.AddScoped<AkordishKeit.Services.EmailPipeline.IBrevoEmailSender, AkordishKeit.Services.EmailPipeline.BrevoEmailSender>();
builder.Services.AddScoped<AkordishKeit.Services.EmailPipeline.IMessageTracker, AkordishKeit.Services.EmailPipeline.BlobMessageTracker>();
builder.Services.AddScoped<AkordishKeit.Services.EmailPipeline.IEmailPersonalizationStep, AkordishKeit.Services.EmailPipeline.EmailPersonalizationStep>();
builder.Services.AddScoped<AkordishKeit.Services.EmailPipeline.IEmailUtmStep, AkordishKeit.Services.EmailPipeline.EmailUtmStep>();
builder.Services.AddScoped<AkordishKeit.Services.EmailPipeline.IEmailSendPipeline, AkordishKeit.Services.EmailPipeline.EmailSendPipeline>();
builder.Services.AddSingleton<AkordishKeit.Services.EmailPipeline.EmailTransientSendJobService>();
builder.Services.AddSingleton<AkordishKeit.Services.EmailPipeline.IEmailTransientSendJobService>(sp => sp.GetRequiredService<AkordishKeit.Services.EmailPipeline.EmailTransientSendJobService>());
builder.Services.AddScoped<AkordishKeit.Services.EmailTrackingService>();

// Storage
builder.Services.AddSingleton<IAzureBlobService, AzureBlobService>();

// Add Background Services
builder.Services.AddHostedService<CleanupService>();
builder.Services.AddHostedService<BumpSchedulerService>();
builder.Services.AddHostedService<AkordishKeit.Services.EmailPipeline.EmailTransientSendJobWorker>();

// Add DbContext
builder.Services.AddDbContext<AkordishKeitDbContext>(options =>
    options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sqlOptions => sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

// Add JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
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
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:4200", "https://localhost:4200" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular",
        policy =>
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                  .AllowCredentials(); // 🔐 מאפשר cookies ו-authentication credentials
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AkordishKeitDbContext>();
    var connStr = dbContext.Database.GetConnectionString() ?? "";
    var masked = connStr.Length > 20 ? connStr[..20] + "..." : connStr;
    app.Logger.LogInformation("DB connection string prefix: {ConnStr}", masked);

    List<string> pendingMigrations;
    try
    {
        pendingMigrations = dbContext.Database.GetPendingMigrations().ToList();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Cannot connect to database. App will start but DB features will fail.");
        pendingMigrations = [];
    }

    if (pendingMigrations.Count > 0)
    {
        foreach (var migrationId in pendingMigrations)
        {
            try
            {
                dbContext.Database.Migrate(migrationId);
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "Migration {MigrationId} skipped. Continuing with startup.", migrationId);
            }
        }
    }

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Podcasts]', N'U') IS NULL
        BEGIN
            CREATE TABLE [Podcasts] (
                [Id] int NOT NULL IDENTITY,
                [Name] nvarchar(200) NOT NULL,
                [Slug] nvarchar(220) NOT NULL,
                [Description] nvarchar(1000) NULL,
                [ImageUrl] nvarchar(1000) NULL,
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_Podcasts_DisplayOrder] DEFAULT 0,
                [IsActive] bit NOT NULL CONSTRAINT [DF_Podcasts_IsActive] DEFAULT CAST(1 AS bit),
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Podcasts_CreatedAt] DEFAULT (GETUTCDATE()),
                [UpdatedAt] datetime2 NULL,
                [IsDeleted] bit NOT NULL CONSTRAINT [DF_Podcasts_IsDeleted] DEFAULT CAST(0 AS bit),
                CONSTRAINT [PK_Podcasts] PRIMARY KEY ([Id])
            );
        END

        IF OBJECT_ID(N'[PodcastEpisodes]', N'U') IS NULL
        BEGIN
            CREATE TABLE [PodcastEpisodes] (
                [Id] int NOT NULL IDENTITY,
                [PodcastId] int NOT NULL,
                [Title] nvarchar(250) NOT NULL,
                [Slug] nvarchar(260) NOT NULL,
                [Description] nvarchar(1000) NULL,
                [EpisodeNumber] int NOT NULL CONSTRAINT [DF_PodcastEpisodes_EpisodeNumber] DEFAULT 0,
                [SourceUrl] nvarchar(1000) NOT NULL,
                [EmbedUrl] nvarchar(1000) NOT NULL,
                [ThumbnailUrl] nvarchar(1000) NULL,
                [Platform] nvarchar(80) NOT NULL CONSTRAINT [DF_PodcastEpisodes_Platform] DEFAULT N'YouTube',
                [ViewCount] int NOT NULL CONSTRAINT [DF_PodcastEpisodes_ViewCount] DEFAULT 0,
                [PublishedAt] datetime2 NOT NULL CONSTRAINT [DF_PodcastEpisodes_PublishedAt] DEFAULT (GETUTCDATE()),
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_PodcastEpisodes_DisplayOrder] DEFAULT 0,
                [IsActive] bit NOT NULL CONSTRAINT [DF_PodcastEpisodes_IsActive] DEFAULT CAST(1 AS bit),
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_PodcastEpisodes_CreatedAt] DEFAULT (GETUTCDATE()),
                [UpdatedAt] datetime2 NULL,
                [IsDeleted] bit NOT NULL CONSTRAINT [DF_PodcastEpisodes_IsDeleted] DEFAULT CAST(0 AS bit),
                CONSTRAINT [PK_PodcastEpisodes] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_PodcastEpisodes_Podcasts_PodcastId] FOREIGN KEY ([PodcastId]) REFERENCES [Podcasts] ([Id]) ON DELETE CASCADE
            );
        END

        IF OBJECT_ID(N'[Podcasts]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Podcasts]', N'ImageUrl') IS NULL
            ALTER TABLE [Podcasts] ADD [ImageUrl] nvarchar(1000) NULL;

        IF OBJECT_ID(N'[PodcastEpisodes]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[PodcastEpisodes]', N'ViewCount') IS NULL
            ALTER TABLE [PodcastEpisodes] ADD [ViewCount] int NOT NULL CONSTRAINT [DF_PodcastEpisodes_ViewCount] DEFAULT 0;

        IF OBJECT_ID(N'[PodcastEpisodeArtists]', N'U') IS NULL
        BEGIN
            CREATE TABLE [PodcastEpisodeArtists] (
                [Id] int NOT NULL IDENTITY,
                [PodcastEpisodeId] int NOT NULL,
                [ArtistId] int NOT NULL,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_PodcastEpisodeArtists_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_PodcastEpisodeArtists] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_PodcastEpisodeArtists_PodcastEpisodes_PodcastEpisodeId] FOREIGN KEY ([PodcastEpisodeId]) REFERENCES [PodcastEpisodes] ([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_PodcastEpisodeArtists_Artists_ArtistId] FOREIGN KEY ([ArtistId]) REFERENCES [Artists] ([Id]) ON DELETE CASCADE
            );
        END

        IF OBJECT_ID(N'[PodcastEpisodeViews]', N'U') IS NULL
        BEGIN
            CREATE TABLE [PodcastEpisodeViews] (
                [Id] int NOT NULL IDENTITY,
                [PodcastEpisodeId] int NOT NULL,
                [UserId] int NULL,
                [IpAddress] nvarchar(45) NULL,
                [UserAgent] nvarchar(500) NULL,
                [ViewedAt] datetime2 NOT NULL CONSTRAINT [DF_PodcastEpisodeViews_ViewedAt] DEFAULT (GETUTCDATE()),
                [Referrer] nvarchar(500) NULL,
                CONSTRAINT [PK_PodcastEpisodeViews] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_PodcastEpisodeViews_PodcastEpisodes_PodcastEpisodeId] FOREIGN KEY ([PodcastEpisodeId]) REFERENCES [PodcastEpisodes] ([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_PodcastEpisodeViews_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE SET NULL
            );
        END

        IF OBJECT_ID(N'[Podcasts]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Podcasts_Slug' AND object_id = OBJECT_ID(N'[Podcasts]'))
            CREATE UNIQUE INDEX [IX_Podcasts_Slug] ON [Podcasts] ([Slug]) WHERE [IsDeleted] = 0;

        IF OBJECT_ID(N'[Podcasts]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Podcasts_Public' AND object_id = OBJECT_ID(N'[Podcasts]'))
            CREATE INDEX [IX_Podcasts_Public] ON [Podcasts] ([IsDeleted], [IsActive], [DisplayOrder]);

        IF OBJECT_ID(N'[PodcastEpisodes]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodes_Podcast_Slug' AND object_id = OBJECT_ID(N'[PodcastEpisodes]'))
            CREATE UNIQUE INDEX [IX_PodcastEpisodes_Podcast_Slug] ON [PodcastEpisodes] ([PodcastId], [Slug]) WHERE [IsDeleted] = 0;

        IF OBJECT_ID(N'[PodcastEpisodes]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodes_Public_Latest' AND object_id = OBJECT_ID(N'[PodcastEpisodes]'))
            CREATE INDEX [IX_PodcastEpisodes_Public_Latest] ON [PodcastEpisodes] ([IsDeleted], [IsActive], [PublishedAt] DESC);

        IF OBJECT_ID(N'[PodcastEpisodes]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodes_Public_Popular' AND object_id = OBJECT_ID(N'[PodcastEpisodes]'))
            CREATE INDEX [IX_PodcastEpisodes_Public_Popular] ON [PodcastEpisodes] ([IsDeleted], [IsActive], [ViewCount] DESC);

        IF OBJECT_ID(N'[PodcastEpisodeArtists]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodeArtists_EpisodeId_ArtistId' AND object_id = OBJECT_ID(N'[PodcastEpisodeArtists]'))
            CREATE UNIQUE INDEX [IX_PodcastEpisodeArtists_EpisodeId_ArtistId] ON [PodcastEpisodeArtists] ([PodcastEpisodeId], [ArtistId]);

        IF OBJECT_ID(N'[PodcastEpisodeArtists]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodeArtists_ArtistId' AND object_id = OBJECT_ID(N'[PodcastEpisodeArtists]'))
            CREATE INDEX [IX_PodcastEpisodeArtists_ArtistId] ON [PodcastEpisodeArtists] ([ArtistId]);

        IF OBJECT_ID(N'[PodcastEpisodeViews]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodeViews_Episode_ViewedAt' AND object_id = OBJECT_ID(N'[PodcastEpisodeViews]'))
            CREATE INDEX [IX_PodcastEpisodeViews_Episode_ViewedAt] ON [PodcastEpisodeViews] ([PodcastEpisodeId], [ViewedAt]);

        IF OBJECT_ID(N'[PodcastEpisodeViews]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodeViews_Episode_User_ViewedAt' AND object_id = OBJECT_ID(N'[PodcastEpisodeViews]'))
            CREATE INDEX [IX_PodcastEpisodeViews_Episode_User_ViewedAt] ON [PodcastEpisodeViews] ([PodcastEpisodeId], [UserId], [ViewedAt]);

        IF OBJECT_ID(N'[PodcastEpisodeViews]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PodcastEpisodeViews_Episode_Guest_ViewedAt' AND object_id = OBJECT_ID(N'[PodcastEpisodeViews]'))
            CREATE INDEX [IX_PodcastEpisodeViews_Episode_Guest_ViewedAt] ON [PodcastEpisodeViews] ([PodcastEpisodeId], [IpAddress], [UserAgent], [ViewedAt]);
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Agencies]', N'U') IS NULL
        BEGIN
            CREATE TABLE [Agencies] (
                [Id] int NOT NULL IDENTITY,
                [Name] nvarchar(200) NOT NULL,
                [Slug] nvarchar(220) NOT NULL,
                [LogoUrl] nvarchar(500) NULL,
                [BannerImageUrl] nvarchar(500) NULL,
                [BannerBlur] int NOT NULL CONSTRAINT [DF_Agencies_BannerBlur] DEFAULT 0,
                [ShortDescription] nvarchar(500) NULL,
                [FullDescription] nvarchar(4000) NULL,
                [PhoneNumber] nvarchar(20) NULL,
                [WhatsAppNumber] nvarchar(20) NULL,
                [Email] nvarchar(200) NULL,
                [WebsiteUrl] nvarchar(500) NULL,
                [BrandPrimaryColor] nvarchar(20) NULL,
                [BrandSecondaryColor] nvarchar(20) NULL,
                [BrandTextColor] nvarchar(20) NULL,
                [IsActive] bit NOT NULL CONSTRAINT [DF_Agencies_IsActive] DEFAULT CAST(1 AS bit),
                [ShowInIndexBanner] bit NOT NULL CONSTRAINT [DF_Agencies_ShowInIndexBanner] DEFAULT CAST(0 AS bit),
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_Agencies_DisplayOrder] DEFAULT 0,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Agencies_CreatedAt] DEFAULT (GETUTCDATE()),
                [UpdatedAt] datetime2 NULL,
                [IsDeleted] bit NOT NULL CONSTRAINT [DF_Agencies_IsDeleted] DEFAULT CAST(0 AS bit),
                CONSTRAINT [PK_Agencies] PRIMARY KEY ([Id])
            );
        END

        IF OBJECT_ID(N'[Agencies]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Agencies]', N'BannerBlur') IS NULL
        BEGIN
            ALTER TABLE [Agencies]
            ADD [BannerBlur] int NOT NULL CONSTRAINT [DF_Agencies_BannerBlur] DEFAULT 0;
        END

        IF OBJECT_ID(N'[AgencyProfiles]', N'U') IS NULL
        BEGIN
            CREATE TABLE [AgencyProfiles] (
                [Id] int NOT NULL IDENTITY,
                [AgencyId] int NOT NULL,
                [ProfileType] nvarchar(40) NOT NULL,
                [ProfileId] int NOT NULL,
                [ContactMode] int NOT NULL CONSTRAINT [DF_AgencyProfiles_ContactMode] DEFAULT 0,
                [ShowBadge] bit NOT NULL CONSTRAINT [DF_AgencyProfiles_ShowBadge] DEFAULT CAST(1 AS bit),
                [IsFeaturedByAgency] bit NOT NULL CONSTRAINT [DF_AgencyProfiles_IsFeaturedByAgency] DEFAULT CAST(0 AS bit),
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_AgencyProfiles_DisplayOrder] DEFAULT 0,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgencyProfiles_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_AgencyProfiles] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_AgencyProfiles_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
            );
        END

        IF OBJECT_ID(N'[AgencyContents]', N'U') IS NULL
        BEGIN
            CREATE TABLE [AgencyContents] (
                [Id] int NOT NULL IDENTITY,
                [AgencyId] int NOT NULL,
                [ContentType] nvarchar(40) NOT NULL,
                [ContentId] int NOT NULL,
                [IsFeatured] bit NOT NULL CONSTRAINT [DF_AgencyContents_IsFeatured] DEFAULT CAST(0 AS bit),
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_AgencyContents_DisplayOrder] DEFAULT 0,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgencyContents_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_AgencyContents] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_AgencyContents_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
            );
        END

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_Slug' AND object_id = OBJECT_ID(N'[Agencies]'))
            CREATE UNIQUE INDEX [IX_Agencies_Slug] ON [Agencies] ([Slug]) WHERE [IsDeleted] = 0;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Agencies_PublicBanners' AND object_id = OBJECT_ID(N'[Agencies]'))
            CREATE INDEX [IX_Agencies_PublicBanners] ON [Agencies] ([IsDeleted], [IsActive], [ShowInIndexBanner], [DisplayOrder]);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_Profile_Unique' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
            CREATE UNIQUE INDEX [IX_AgencyProfiles_Profile_Unique] ON [AgencyProfiles] ([ProfileType], [ProfileId]);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyProfiles_Agency_Profile_Unique' AND object_id = OBJECT_ID(N'[AgencyProfiles]'))
            CREATE UNIQUE INDEX [IX_AgencyProfiles_Agency_Profile_Unique] ON [AgencyProfiles] ([AgencyId], [ProfileType], [ProfileId]);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AgencyContents_Agency_Content_Unique' AND object_id = OBJECT_ID(N'[AgencyContents]'))
            CREATE UNIQUE INDEX [IX_AgencyContents_Agency_Content_Unique] ON [AgencyContents] ([AgencyId], [ContentType], [ContentId]);

        IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NULL
        BEGIN
            CREATE TABLE [AgencyGalleryImages] (
                [Id] int NOT NULL IDENTITY,
                [AgencyId] int NOT NULL,
                [MediaType] nvarchar(20) NOT NULL CONSTRAINT [DF_AgencyGalleryImages_MediaType] DEFAULT N'image',
                [ImageUrl] nvarchar(500) NULL,
                [VideoUrl] nvarchar(500) NULL,
                [Title] nvarchar(200) NULL,
                [Caption] nvarchar(200) NULL,
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_AgencyGalleryImages_DisplayOrder] DEFAULT 0,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgencyGalleryImages_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_AgencyGalleryImages] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_AgencyGalleryImages_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
            );
            CREATE INDEX [IX_AgencyGalleryImages_AgencyId] ON [AgencyGalleryImages] ([AgencyId]);
        END

        IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[AgencyGalleryImages]', N'MediaType') IS NULL
        BEGIN
            ALTER TABLE [AgencyGalleryImages]
            ADD [MediaType] nvarchar(20) NOT NULL CONSTRAINT [DF_AgencyGalleryImages_MediaType] DEFAULT N'image';
        END

        IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[AgencyGalleryImages]', N'VideoUrl') IS NULL
        BEGIN
            ALTER TABLE [AgencyGalleryImages]
            ADD [VideoUrl] nvarchar(500) NULL;
        END

        IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[AgencyGalleryImages]', N'Title') IS NULL
        BEGIN
            ALTER TABLE [AgencyGalleryImages]
            ADD [Title] nvarchar(200) NULL;
        END

        IF OBJECT_ID(N'[AgencyGalleryImages]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[AgencyGalleryImages]', N'ImageUrl') IS NOT NULL
        BEGIN
            ALTER TABLE [AgencyGalleryImages]
            ALTER COLUMN [ImageUrl] nvarchar(500) NULL;
        END

        IF OBJECT_ID(N'[AgencySocialLinks]', N'U') IS NULL
        BEGIN
            CREATE TABLE [AgencySocialLinks] (
                [Id] int NOT NULL IDENTITY,
                [AgencyId] int NOT NULL,
                [Platform] int NOT NULL,
                [Url] nvarchar(500) NOT NULL,
                CONSTRAINT [PK_AgencySocialLinks] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_AgencySocialLinks_Agencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [Agencies] ([Id]) ON DELETE CASCADE
            );
            CREATE INDEX [IX_AgencySocialLinks_AgencyId] ON [AgencySocialLinks] ([AgencyId]);
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Playlists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Playlists]', N'IsDefault') IS NULL
        BEGIN
            ALTER TABLE [Playlists]
            ADD [IsDefault] bit NOT NULL CONSTRAINT [DF_Playlists_IsDefault] DEFAULT 0;
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Songs]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Songs]', N'SheetMusicUrl') IS NULL
        BEGIN
            ALTER TABLE [Songs]
            ADD [SheetMusicUrl] nvarchar(500) NULL;
        END
    ");

    // Seed ad spots — נוצרים אוטומטית אם לא קיימים
    var adSpotSeeds = new[]
    {
        new { Name = "באנר עליון דף הבית",            TechnicalId = "home-top-banner",      Dimensions = "970x250", Description = "לאחר סקציית חדשות המוזיקה" },
        new { Name = "באנר אמצעי דף הבית",            TechnicalId = "home-mid-banner",      Dimensions = "970x250", Description = "לפני סקציית בעלי המקצוע" },
        new { Name = "באנר תחתון דף הבית",            TechnicalId = "home-bottom-banner",   Dimensions = "970x90",  Description = "לפני סקציית כתבות תוכן" },
        new { Name = "סיידבר שמאל — דף כתבה",        TechnicalId = "view-article-right",   Dimensions = "160x600", Description = "עמודת פרסומת שמאל בדף כתבה בודדת" },
        new { Name = "סיידבר ימין — דף כתבה",        TechnicalId = "view-article-left",    Dimensions = "160x600", Description = "עמודת פרסומת ימין בדף כתבה בודדת" },
        new { Name = "סיידבר שמאל — דף בלוג",        TechnicalId = "blog-post-right",      Dimensions = "160x600", Description = "עמודת פרסומת שמאל בדף בלוג בודד" },
        new { Name = "סיידבר ימין — דף בלוג",        TechnicalId = "blog-post-left",       Dimensions = "160x600", Description = "עמודת פרסומת ימין בדף בלוג בודד" },
        new { Name = "באנר אמצע — דף כתבה",         TechnicalId = "view-article-mid-banner", Dimensions = "728x250", Description = "באנר מלבני 70% רוחב מתחת לחוות דעת בכתבה" },
        new { Name = "באנר אמצע — דף בלוג",          TechnicalId = "blog-post-mid-banner",       Dimensions = "728x250", Description = "באנר מלבני 70% רוחב מתחת לחוות דעת בבלוג" },
        new { Name = "באנר עליון — אינדקס מוזיקה",  TechnicalId = "professionals-top-banner",   Dimensions = "970x250", Description = "בראש תוכן הדף, מתחת להירו" },
        new { Name = "באנר אמצע — אינדקס מוזיקה",   TechnicalId = "professionals-sections-mid", Dimensions = "970x200", Description = "בין מומלצים לסוכנויות בטאב בעלי מקצוע" },
        new { Name = "באנר לפני קטלוג — אינדקס מוזיקה", TechnicalId = "professionals-pre-catalog", Dimensions = "970x200", Description = "לפני גריד כל בעלי המוזיקה" },
        new { Name = "באנר מורים — אינדקס מוזיקה",  TechnicalId = "professionals-teachers-mid", Dimensions = "970x200", Description = "בטאב מורים, אחרי מורים מומלצים" },
        new { Name = "באנר נעילה — דף שיר",          TechnicalId = "song-page-locked-banner",    Dimensions = "728x250", Description = "מוצג מתחת לכפתור ההתחברות כשתוכן השיר חסום" },
        new { Name = "באנר עליון — דף אמנים",        TechnicalId = "artists-list-top-banner",    Dimensions = "970x250", Description = "בין שורות האמנים המומלצים לרשת הכללית" },
        new { Name = "באנר תחתון — דף אמנים",        TechnicalId = "artists-list-bottom-banner", Dimensions = "970x90",  Description = "לפני pagination ברשת האמנים הכללית" },
    };

    foreach (var seed in adSpotSeeds)
    {
        if (!dbContext.AdSpots.Any(s => s.TechnicalId == seed.TechnicalId))
        {
            dbContext.AdSpots.Add(new AkordishKeit.Models.Entities.AdSpot
            {
                Name = seed.Name,
                TechnicalId = seed.TechnicalId,
                Dimensions = seed.Dimensions,
                Description = seed.Description,
                IsActive = true,
                RotationIntervalMs = 30000,
                CreatedAt = DateTime.UtcNow
            });
        }
    }
    dbContext.SaveChanges();
dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Users]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Users]', N'MarketingConsent') IS NULL
        BEGIN
            ALTER TABLE [Users]
            ADD [MarketingConsent] bit NOT NULL CONSTRAINT [DF_Users_MarketingConsent] DEFAULT CAST(0 AS bit);
        END

        IF OBJECT_ID(N'[Users]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Users]', N'MarketingConsentAt') IS NULL
        BEGIN
            ALTER TABLE [Users]
            ADD [MarketingConsentAt] datetime2 NULL;
        END

        IF OBJECT_ID(N'[Users]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Users]', N'MarketingConsentRevokedAt') IS NULL
        BEGIN
            ALTER TABLE [Users]
            ADD [MarketingConsentRevokedAt] datetime2 NULL;
        END

        IF OBJECT_ID(N'[Users]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Users]', N'MarketingConsentSource') IS NULL
        BEGIN
            ALTER TABLE [Users]
            ADD [MarketingConsentSource] nvarchar(100) NULL;
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Articles]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Articles_CreatedAt' AND object_id = OBJECT_ID(N'[Articles]'))
        BEGIN
            CREATE INDEX [IX_Articles_CreatedAt] ON [Articles] ([CreatedAt] DESC);
        END

        IF OBJECT_ID(N'[Articles]', N'U') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Articles_Status_ContentType_CreatedAt' AND object_id = OBJECT_ID(N'[Articles]'))
        BEGIN
            CREATE INDEX [IX_Articles_Status_ContentType_CreatedAt] ON [Articles] ([Status], [ContentType], [CreatedAt] DESC);
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[ArtistAlbums]', N'U') IS NULL
        BEGIN
            CREATE TABLE [ArtistAlbums] (
                [Id] int NOT NULL IDENTITY,
                [ArtistId] int NOT NULL,
                [Title] nvarchar(200) NOT NULL,
                [CoverImageUrl] nvarchar(2048) NOT NULL,
                [ReleaseYear] int NULL,
                [ExternalUrl] nvarchar(500) NOT NULL,
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_ArtistAlbums_DisplayOrder] DEFAULT 0,
                [IsActive] bit NOT NULL CONSTRAINT [DF_ArtistAlbums_IsActive] DEFAULT CAST(1 AS bit),
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_ArtistAlbums_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_ArtistAlbums] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_ArtistAlbums_Artists_ArtistId] FOREIGN KEY ([ArtistId]) REFERENCES [Artists] ([Id]) ON DELETE CASCADE
            );
            CREATE INDEX [IX_ArtistAlbums_ArtistId] ON [ArtistAlbums] ([ArtistId]);
        END

        IF OBJECT_ID(N'[ArtistAlbums]', N'U') IS NOT NULL
           AND COL_LENGTH(N'ArtistAlbums', N'CoverImageUrl') < 4096
        BEGIN
            ALTER TABLE [ArtistAlbums] ALTER COLUMN [CoverImageUrl] nvarchar(2048) NOT NULL;
        END

        IF OBJECT_ID(N'[ArtistHits]', N'U') IS NULL
        BEGIN
            CREATE TABLE [ArtistHits] (
                [Id] int NOT NULL IDENTITY,
                [ArtistId] int NOT NULL,
                [Title] nvarchar(200) NOT NULL,
                [ImageUrl] nvarchar(500) NULL,
                [YouTubeUrl] nvarchar(500) NOT NULL,
                [DisplayOrder] int NOT NULL CONSTRAINT [DF_ArtistHits_DisplayOrder] DEFAULT 0,
                [IsActive] bit NOT NULL CONSTRAINT [DF_ArtistHits_IsActive] DEFAULT CAST(1 AS bit),
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_ArtistHits_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_ArtistHits] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_ArtistHits_Artists_ArtistId] FOREIGN KEY ([ArtistId]) REFERENCES [Artists] ([Id]) ON DELETE CASCADE
            );
            CREATE INDEX [IX_ArtistHits_ArtistId] ON [ArtistHits] ([ArtistId]);
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

        IF OBJECT_ID(N'[EmailGroups]', N'U') IS NULL
        BEGIN
            CREATE TABLE [EmailGroups] (
                [Id]              int           NOT NULL IDENTITY,
                [Name]            nvarchar(160) NOT NULL,
                [Description]     nvarchar(500) NULL,
                [IsDeleted]       bit           NOT NULL CONSTRAINT [DF_EmailGroups_IsDeleted] DEFAULT CAST(0 AS bit),
                [CreatedAt]       datetime2     NOT NULL CONSTRAINT [DF_EmailGroups_CreatedAt] DEFAULT (GETUTCDATE()),
                [UpdatedAt]       datetime2     NULL,
                [CreatedByUserId] int           NOT NULL,
                CONSTRAINT [PK_EmailGroups] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_EmailGroups_Users_CreatedByUserId]
                    FOREIGN KEY ([CreatedByUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END

        IF OBJECT_ID(N'[EmailGroupMembers]', N'U') IS NULL
        BEGIN
            CREATE TABLE [EmailGroupMembers] (
                [EmailGroupId] int       NOT NULL,
                [UserId]       int       NOT NULL,
                [AddedAt]      datetime2 NOT NULL CONSTRAINT [DF_EmailGroupMembers_AddedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_EmailGroupMembers] PRIMARY KEY ([EmailGroupId], [UserId]),
                CONSTRAINT [FK_EmailGroupMembers_EmailGroups_EmailGroupId]
                    FOREIGN KEY ([EmailGroupId]) REFERENCES [EmailGroups] ([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_EmailGroupMembers_Users_UserId]
                    FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
            );
        END

        IF OBJECT_ID(N'[SiteInterestRegistrations]', N'U') IS NULL
        BEGIN
            CREATE TABLE [SiteInterestRegistrations] (
                [Id]        int           NOT NULL IDENTITY,
                [Email]     nvarchar(320) NOT NULL,
                [Source]    nvarchar(100) NULL,
                [CreatedAt] datetime2     NOT NULL CONSTRAINT [DF_SiteInterest_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_SiteInterestRegistrations] PRIMARY KEY ([Id])
            );
            CREATE UNIQUE INDEX [IX_SiteInterestRegistrations_Email] ON [SiteInterestRegistrations] ([Email]);
        END

        IF OBJECT_ID(N'[AdBlockChecks]', N'U') IS NULL
        BEGIN
            CREATE TABLE [AdBlockChecks] (
                [Id]         int            NOT NULL IDENTITY,
                [Detected]   bit            NOT NULL DEFAULT CAST(0 AS bit),
                [PagePath]   nvarchar(500)  NULL,
                [DeviceType] nvarchar(50)   NULL,
                [UserId]     int            NULL,
                [IpAddress]  nvarchar(45)   NULL,
                [UserAgent]  nvarchar(500)  NULL,
                [CheckedAt]  datetime2      NOT NULL DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_AdBlockChecks] PRIMARY KEY ([Id]),
                CONSTRAINT [FK_AdBlockChecks_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE SET NULL
            );
            CREATE INDEX [IX_AdBlockChecks_UserId] ON [AdBlockChecks] ([UserId]);
            CREATE INDEX [IX_AdBlockChecks_CheckedAt] ON [AdBlockChecks] ([CheckedAt]);
        END
    ");

    dbContext.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'[Songs]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Songs]', N'BumpedAt') IS NULL
            ALTER TABLE [Songs] ADD [BumpedAt] datetime2 NULL;

        IF OBJECT_ID(N'[Songs]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Songs]', N'BumpCount') IS NULL
            ALTER TABLE [Songs] ADD [BumpCount] int NOT NULL CONSTRAINT [DF_Songs_BumpCount] DEFAULT 0;

        IF OBJECT_ID(N'[Articles]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Articles]', N'BumpedAt') IS NULL
            ALTER TABLE [Articles] ADD [BumpedAt] datetime2 NULL;

        IF OBJECT_ID(N'[Articles]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Articles]', N'BumpCount') IS NULL
            ALTER TABLE [Articles] ADD [BumpCount] int NOT NULL CONSTRAINT [DF_Articles_BumpCount] DEFAULT 0;

        IF OBJECT_ID(N'[Playlists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Playlists]', N'BumpedAt') IS NULL
            ALTER TABLE [Playlists] ADD [BumpedAt] datetime2 NULL;

        IF OBJECT_ID(N'[Playlists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Playlists]', N'BumpCount') IS NULL
            ALTER TABLE [Playlists] ADD [BumpCount] int NOT NULL CONSTRAINT [DF_Playlists_BumpCount] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviders]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviders]', N'BumpedAt') IS NULL
            ALTER TABLE [MusicServiceProviders] ADD [BumpedAt] datetime2 NULL;

        IF OBJECT_ID(N'[MusicServiceProviders]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviders]', N'BumpCount') IS NULL
            ALTER TABLE [MusicServiceProviders] ADD [BumpCount] int NOT NULL CONSTRAINT [DF_MusicServiceProviders_BumpCount] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviders]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviders]', N'BannerBlur') IS NULL
            ALTER TABLE [MusicServiceProviders] ADD [BannerBlur] int NOT NULL CONSTRAINT [DF_MusicServiceProviders_BannerBlur] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryInstrumentId') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [QuickCategoryInstrumentId] int NULL;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryType') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [QuickCategoryType] int NOT NULL CONSTRAINT [DF_MusicServiceProviderCategories_QuickCategoryType] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'ShowInQuickCategories') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [ShowInQuickCategories] bit NOT NULL CONSTRAINT [DF_MusicServiceProviderCategories_ShowInQuickCategories] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryLabel') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [QuickCategoryLabel] nvarchar(120) NULL;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryImageUrl') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [QuickCategoryImageUrl] nvarchar(500) NULL;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryOrder') IS NULL
            ALTER TABLE [MusicServiceProviderCategories] ADD [QuickCategoryOrder] int NOT NULL CONSTRAINT [DF_MusicServiceProviderCategories_QuickCategoryOrder] DEFAULT 0;

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryInstrumentId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MusicServiceProviderCategories_QuickCategoryInstrumentId' AND object_id = OBJECT_ID(N'[MusicServiceProviderCategories]'))
            CREATE INDEX [IX_MusicServiceProviderCategories_QuickCategoryInstrumentId] ON [MusicServiceProviderCategories] ([QuickCategoryInstrumentId]);

        IF OBJECT_ID(N'[MusicServiceProviderCategories]', N'U') IS NOT NULL
           AND OBJECT_ID(N'[Instruments]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[MusicServiceProviderCategories]', N'QuickCategoryInstrumentId') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId')
            ALTER TABLE [MusicServiceProviderCategories] ADD CONSTRAINT [FK_MusicServiceProviderCategories_Instruments_QuickCategoryInstrumentId]
                FOREIGN KEY ([QuickCategoryInstrumentId]) REFERENCES [Instruments] ([Id]);

        IF OBJECT_ID(N'[Artists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Artists]', N'BumpedAt') IS NULL
            ALTER TABLE [Artists] ADD [BumpedAt] datetime2 NULL;

        IF OBJECT_ID(N'[Artists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Artists]', N'BumpCount') IS NULL
            ALTER TABLE [Artists] ADD [BumpCount] int NOT NULL CONSTRAINT [DF_Artists_BumpCount] DEFAULT 0;

        IF OBJECT_ID(N'[Artists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Artists]', N'IsFeatured') IS NULL
            ALTER TABLE [Artists] ADD [IsFeatured] bit NOT NULL CONSTRAINT [DF_Artists_IsFeatured] DEFAULT 0;

        IF OBJECT_ID(N'[Artists]', N'U') IS NOT NULL
           AND COL_LENGTH(N'[Artists]', N'IsFeatured') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Artists_IsFeatured' AND object_id = OBJECT_ID(N'[Artists]'))
            CREATE INDEX [IX_Artists_IsFeatured] ON [Artists] ([IsFeatured]);

        IF OBJECT_ID(N'[BumpSchedules]', N'U') IS NULL
        BEGIN
            CREATE TABLE [BumpSchedules] (
                [Id] int NOT NULL IDENTITY,
                [EntityType] nvarchar(50) NOT NULL,
                [EntityId] int NOT NULL,
                [TotalTimes] int NOT NULL,
                [RemainingTimes] int NOT NULL,
                [IntervalHours] int NOT NULL,
                [NextBumpAt] datetime2 NOT NULL,
                [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_BumpSchedules_CreatedAt] DEFAULT (GETUTCDATE()),
                CONSTRAINT [PK_BumpSchedules] PRIMARY KEY ([Id])
            );
            CREATE INDEX [IX_BumpSchedules_EntityType_EntityId] ON [BumpSchedules] ([EntityType], [EntityId]);
            CREATE INDEX [IX_BumpSchedules_NextBumpAt] ON [BumpSchedules] ([NextBumpAt]);
        END
    ");

}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Global exception handler — must be first
app.UseMiddleware<ExceptionMiddleware>();

// Log every HTTP request: method, path, status code, elapsed ms
app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} → {StatusCode} ({Elapsed:0}ms)";
});

app.UseHttpsRedirection();
app.UseCors("AllowAngular");

// Enable static files for uploaded media
app.UseStaticFiles();
app.UseRateLimiter();
app.UseMiddleware<SiteAccessGateMiddleware>();

// חשוב! Authentication לפני Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.Run();
