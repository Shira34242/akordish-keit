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

// Add Services
builder.Services.AddScoped<IArticleService, ArticleService>();
builder.Services.AddScoped<ISongService, SongService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IFeaturedContentService, FeaturedContentService>();
builder.Services.AddScoped<IMusicServiceProviderService, MusicServiceProviderService>();
builder.Services.AddScoped<ITeacherService, TeacherService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<ILikedContentService, LikedContentService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IBoostService, BoostService>();

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