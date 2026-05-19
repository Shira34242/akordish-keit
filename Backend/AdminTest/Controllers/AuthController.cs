using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private const string DEFAULT_PROFILE_IMAGE_URL = "/default-avatar.svg";

        private readonly AkordishKeitDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ICsrfTokenService _csrfTokenService;
        private readonly IAzureBlobService _blobService;
        private readonly IEmailService _emailService;
        private readonly ILogger<AuthController> _logger;

        private static readonly Dictionary<string, (string Code, DateTime Expiry)> _verificationCodes = new();
        private static readonly Dictionary<string, int> _resetAttempts = new();
        private const int MaxResetAttempts = 5;

        public AuthController(
            AkordishKeitDbContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ICsrfTokenService csrfTokenService,
            IAzureBlobService blobService,
            IEmailService emailService,
            ILogger<AuthController> logger)
        {
            _context = context;
            _httpClient = httpClientFactory.CreateClient();
            _configuration = configuration;
            _csrfTokenService = csrfTokenService;
            _blobService = blobService;
            _emailService = emailService;
            _logger = logger;
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<AuthResponse>> Me()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "משתמש לא מזוהה" });
            }

            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.AdminRole)
                    .ThenInclude(r => r!.Permissions)
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            if (user == null || !user.IsActive)
            {
                return Unauthorized(new { message = "משתמש לא פעיל" });
            }

            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(BuildAuthResponse(user, hasProfessionalProfile, isNewRegistration: false));
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            _logger.LogInformation("User logged out: UserId={UserId} IP={IP}",
                userIdClaim ?? "anonymous", HttpContext.Connection.RemoteIpAddress);
            ExpireCookie("auth-token", httpOnly: true);
            ExpireCookie("XSRF-TOKEN", httpOnly: false);
            return Ok(new { message = "התנתקת בהצלחה" });
        }

        [HttpPost("google-login")]
        public async Task<ActionResult<AuthResponse>> GoogleLogin([FromBody] GoogleLoginRequest request)
        {
            if (string.IsNullOrEmpty(request.IdToken))
            {
                return BadRequest("Token is required");
            }

            // 1. Verify Token with Google
            var googleUser = await VerifyGoogleToken(request.IdToken);
            if (googleUser == null)
            {
                _logger.LogWarning("Google login failed — invalid token IP={IP}",
                    HttpContext.Connection.RemoteIpAddress);
                return Unauthorized("Invalid Google Token");
            }

            // 2. Check if user exists (including professional profiles for onboarding check)
            var user = await _context.Users
                .Include(u => u.AdminRole)
                    .ThenInclude(r => r!.Permissions)
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Email == googleUser.Email);

            bool isNewGoogleUser = user == null;
            if (isNewGoogleUser && !request.TermsApproved)
            {
                return BadRequest(new
                {
                    code = "TERMS_REQUIRED",
                    message = "יש לאשר את התקנון ומדיניות הפרטיות כדי להירשם"
                });
            }
            // שמירת תמונת פרופיל ב-Azure Blob (במקום URL ישיר מ-Google שעלול להשתנות)
            // מבוצע כשאין תמונה שמורה, או כשהתמונה הקיימת היא URL ישיר מ-Google
            bool needsImageUpload = user == null
                || string.IsNullOrEmpty(user.ProfileImageUrl)
                || user.ProfileImageUrl.Contains("lh3.googleusercontent.com");

            string? profileImageUrl = user?.ProfileImageUrl;
            if (needsImageUpload && !string.IsNullOrEmpty(googleUser.Picture))
            {
                profileImageUrl = await UploadGoogleProfileImageAsync(googleUser.Picture) ?? googleUser.Picture;
            }

            if (user == null)
            {
                // 3. Create new user
                user = new User
                {
                    Username = googleUser.Name,
                    Email = googleUser.Email,
                    GoogleId = googleUser.Sub,
                    ProfileImageUrl = profileImageUrl,
                    Role = UserRole.Regular,
                    Level = 1,
                    Points = 0,
                    IsActive = true,
                    EmailConfirmed = true, // Verified by Google
                    MarketingConsent = request.MarketingConsent,
                    MarketingConsentAt = request.MarketingConsent ? DateTime.UtcNow : null,
                    MarketingConsentSource = request.MarketingConsent ? "google-registration" : null,
                    CreatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }
            else
            {
                // Update existing user info if needed
                if (string.IsNullOrEmpty(user.GoogleId))
                {
                    user.GoogleId = googleUser.Sub;
                }
                if (needsImageUpload && profileImageUrl != null)
                {
                    user.ProfileImageUrl = profileImageUrl;
                }
                if (request.MarketingConsent && !user.MarketingConsent)
                {
                    user.MarketingConsent = true;
                    user.MarketingConsentAt = DateTime.UtcNow;
                    user.MarketingConsentRevokedAt = null;
                    user.MarketingConsentSource = "google-login";
                }
                user.LastLoginAt = DateTime.UtcNow;
                user.VisitCount++;
                await _context.SaveChangesAsync();
            }

            if (isNewGoogleUser)
                _logger.LogInformation("New user registered via Google: UserId={UserId} Email={Email} IP={IP}",
                    user.Id, user.Email, HttpContext.Connection.RemoteIpAddress);
            else
                _logger.LogInformation("Existing user login via Google: UserId={UserId} Email={Email} IP={IP}",
                    user.Id, user.Email, HttpContext.Connection.RemoteIpAddress);

            // 4. 🔐 שימוש באימות מאובטח עם Cookies
            // הרשמה חדשה = הצג שאלות onboarding; כניסה חוזרת = אל תציג
            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(HandleSecureAuthentication(user, hasProfessionalProfile, isNewRegistration: isNewGoogleUser));
        }

        private async Task<GoogleTokenInfo?> VerifyGoogleToken(string idToken)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                var response = await _httpClient.GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={idToken}", cts.Token);
                if (!response.IsSuccessStatusCode)
                    return null;

                var content = await response.Content.ReadAsStringAsync(cts.Token);
                return JsonSerializer.Deserialize<GoogleTokenInfo>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch
            {
                return null;
            }
        }

        private string GenerateJwtToken(User user)
        {
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));

            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Username),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role.ToString()),
                new("id", user.Id.ToString())
            };

            if (user.AdminRole != null && user.AdminRole.IsActive && !user.AdminRole.IsDeleted)
            {
                claims.Add(new Claim("admin_role_id", user.AdminRole.Id.ToString()));
                claims.Add(new Claim("admin_role_name", user.AdminRole.Name));

                foreach (var permission in user.AdminRole.Permissions.Select(p => p.PermissionKey).Distinct())
                    claims.Add(new Claim("permission", permission));
            }

            if (user.Role == UserRole.Admin)
            {
                foreach (var permission in AdminRoleService.AllPermissionKeys)
                    claims.Add(new Claim("permission", permission));
            }

            var expireDays = int.Parse(_configuration["Jwt:ExpireDays"] ?? "30");

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(expireDays),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// 🔐 מטפל באימות מאובטח עם Cookies
        /// מה קורה כאן:
        /// 1. יוצר JWT token (לאימות)
        /// 2. שומר אותו ב-httpOnly cookie (לא נגיש ל-JavaScript = מאובטח מ-XSS)
        /// 3. יוצר CSRF token (להגנה מ-CSRF attacks)
        /// 4. מחזיר את CSRF token בגוף התגובה (כדי שה-Frontend יוכל לשלוח אותו בכל בקשה)
        /// </summary>
        private AuthResponse HandleSecureAuthentication(User user, bool hasProfessionalProfile = false, bool isNewRegistration = false)
        {
            // 1. יצירת JWT Token
            var jwtToken = GenerateJwtToken(user);
            var expireDays = int.Parse(_configuration["Jwt:ExpireDays"] ?? "30");

            // 2. שמירת JWT ב-httpOnly Cookie (מאובטח!)
            // HttpOnly = JavaScript לא יכול לגשת (הגנה מ-XSS)
            // Secure = רק ב-HTTPS (הגנה מ-Man-in-the-Middle)
            // SameSite = הגנה מ-CSRF
            Response.Cookies.Append("auth-token", jwtToken, new CookieOptions
            {
                HttpOnly = true,          // 🔐 לא נגיש ל-JavaScript
                Secure = true,            // 🔐 רק ב-HTTPS
                SameSite = SameSiteMode.None,  // 🔐 מאפשר cross-origin בdevelopment
                Expires = DateTime.UtcNow.AddDays(expireDays)
            });

            return BuildAuthResponse(user, hasProfessionalProfile, isNewRegistration);
        }

        private AuthResponse BuildAuthResponse(User user, bool hasProfessionalProfile, bool isNewRegistration)
        {
            var csrfToken = IssueCsrfToken();

            return new AuthResponse
            {
                CsrfToken = csrfToken,
                User = BuildUserDto(user, hasProfessionalProfile),
                RequiresProfileCompletion = isNewRegistration
            };
        }

        private string IssueCsrfToken()
        {
            var csrfToken = _csrfTokenService.GenerateToken();

            Response.Cookies.Append("XSRF-TOKEN", csrfToken, new CookieOptions
            {
                HttpOnly = false,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = DateTime.UtcNow.AddMinutes(30)
            });

            return csrfToken;
        }

        private static readonly TimeSpan TagResetPeriod = TimeSpan.FromDays(30 * 4);

        private static bool IsTagReset(User user)
        {
            return user.LastUploadDate == null
                || DateTime.UtcNow - user.LastUploadDate.Value > TagResetPeriod;
        }

        private UserDto BuildUserDto(User user, bool hasProfessionalProfile = false)
        {
            var instruments = user.Instruments?
                .Where(ui => ui.Instrument != null)
                .Select(ui => new InstrumentDto
                {
                    Id = ui.Instrument.Id,
                    Name = ui.Instrument.Name,
                    EnglishName = ui.Instrument.EnglishName
                })
                .ToList() ?? new List<InstrumentDto>();

            bool isReset = IsTagReset(user);
            int effectiveTag = isReset ? 0 : (int)user.ContentTag;
            int effectiveCount = isReset ? 0 : user.UploadCount;

            return new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                ProfileImageUrl = user.ProfileImageUrl,
                Role = user.Role.ToString(),
                AdminRoleId = user.AdminRoleId,
                AdminRoleName = user.AdminRole?.Name,
                Permissions = user.Role == UserRole.Admin
                    ? AdminRoleService.AllPermissionKeys
                    : user.AdminRole?.Permissions.Select(p => p.PermissionKey).OrderBy(p => p).ToList() ?? new List<string>(),
                Level = effectiveTag,
                Points = effectiveCount,
                PreferredInstrumentId = user.PreferredInstrumentId,
                Instruments = instruments,
                OtherInstrumentName = user.OtherInstrumentName,
                InstrumentLevel = user.InstrumentLevel.HasValue ? (int)user.InstrumentLevel.Value : (int?)null,
                Phone = user.Phone,
                Address = user.Address,
                CityId = user.CityId,
                BirthDate = user.BirthDate,
                HasProfessionalProfile = hasProfessionalProfile,
                ContentTag = effectiveTag,
                UploadCount = effectiveCount,
                ChordBookExportCount = user.ChordBookExportCount,
                CreatedAt = user.CreatedAt,
                LastProfileReminderAt = user.LastProfileReminderAt,
                ProfileReminderDismissCount = user.ProfileReminderDismissCount,
                VisitCount = user.VisitCount,
                MarketingConsent = user.MarketingConsent,
                MarketingConsentAt = user.MarketingConsentAt,
                MarketingConsentRevokedAt = user.MarketingConsentRevokedAt
            };
        }

        private void ExpireCookie(string name, bool httpOnly)
        {
            Response.Cookies.Append(name, string.Empty, new CookieOptions
            {
                HttpOnly = httpOnly,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = DateTime.UtcNow.AddDays(-1)
            });
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!request.TermsApproved)
            {
                return BadRequest(new { message = "יש לאשר את התקנון ומדיניות הפרטיות כדי להירשם" });
            }

            // 1. Check if username already exists
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
            {
                _logger.LogWarning("Registration failed — duplicate username: {Username} IP={IP}",
                    request.Username, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "שם המשתמש כבר קיים במערכת" });
            }

            // 2. Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                _logger.LogWarning("Registration failed — duplicate email: {Email} IP={IP}",
                    request.Email, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "כתובת האימייל כבר קיימת במערכת" });
            }

            // 3. Hash password
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            // 4. Create new user
            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordHash = passwordHash,
                ProfileImageUrl = DEFAULT_PROFILE_IMAGE_URL,
                Role = UserRole.Regular,
                Level = 1,
                Points = 0,
                IsActive = true,
                EmailConfirmed = false, // Will need email confirmation
                MarketingConsent = request.MarketingConsent,
                MarketingConsentAt = request.MarketingConsent ? DateTime.UtcNow : null,
                MarketingConsentSource = request.MarketingConsent ? "registration" : null,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _logger.LogInformation("New user registered: UserId={UserId} Email={Email} IP={IP}",
                user.Id, user.Email, HttpContext.Connection.RemoteIpAddress);

            // 5. 🔐 שימוש באימות מאובטח עם Cookies - הרשמה חדשה, הצג שאלות onboarding
            return Ok(HandleSecureAuthentication(user, hasProfessionalProfile: false, isNewRegistration: true));
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // 1. Find user by username or email (including professional profiles for onboarding check)
            var user = await _context.Users
                .Include(u => u.AdminRole)
                    .ThenInclude(r => r!.Permissions)
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Username == request.UsernameOrEmail || u.Email == request.UsernameOrEmail);

            if (user == null)
            {
                _logger.LogWarning("Login failed — user not found: {Identifier} IP={IP}",
                    request.UsernameOrEmail, HttpContext.Connection.RemoteIpAddress);
                return Unauthorized(new { message = "שם משתמש או סיסמא שגויים" });
            }

            // 2. Check if user has password (not Google-only account)
            if (string.IsNullOrEmpty(user.PasswordHash))
            {
                _logger.LogWarning("Login failed — Google-only account tried password login: UserId={UserId} IP={IP}",
                    user.Id, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "משתמש זה נרשם דרך Google. אנא השתמש בכפתור 'כניסה עם Google'" });
            }

            // 3. Verify password
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                _logger.LogWarning("Login failed — wrong password: UserId={UserId} IP={IP}",
                    user.Id, HttpContext.Connection.RemoteIpAddress);
                return Unauthorized(new { message = "שם משתמש או סיסמא שגויים" });
            }

            // 4. Check if user is active
            if (!user.IsActive)
            {
                _logger.LogWarning("Login failed — account suspended: UserId={UserId} Email={Email} IP={IP}",
                    user.Id, user.Email, HttpContext.Connection.RemoteIpAddress);
                return Unauthorized(new { message = "החשבון הושעה. אנא צור קשר עם התמיכה" });
            }

            // 5. Update last login
            user.LastLoginAt = DateTime.UtcNow;
            user.VisitCount++;
            await _context.SaveChangesAsync();

            _logger.LogInformation("User login success: UserId={UserId} Email={Email} IP={IP}",
                user.Id, user.Email, HttpContext.Connection.RemoteIpAddress);

            // 6. 🔐 שימוש באימות מאובטח עם Cookies - כניסה חוזרת, אל תציג שאלות onboarding
            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(HandleSecureAuthentication(user, hasProfessionalProfile, isNewRegistration: false));
        }

        [Authorize]
        [HttpPut("complete-profile")]
        public async Task<ActionResult<UserDto>> CompleteProfile([FromBody] CompleteProfileRequest request)
        {
            // Get user ID from JWT token claims
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "משתמש לא מזוהה" });
            }

            // Find user (with instruments collection for replacement)
            var user = await _context.Users
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "משתמש לא נמצא" });
            }

            // 1. Multi-instrument selection — replace existing
            if (request.InstrumentIds != null)
            {
                // Validate that all instrument IDs exist
                var requestedIds = request.InstrumentIds.Distinct().ToList();
                if (requestedIds.Any())
                {
                    var existingIds = await _context.Instruments
                        .Where(i => requestedIds.Contains(i.Id))
                        .Select(i => i.Id)
                        .ToListAsync();

                    var invalid = requestedIds.Except(existingIds).ToList();
                    if (invalid.Any())
                    {
                        return BadRequest(new { message = $"מזהי כלי נגינה לא תקינים: {string.Join(",", invalid)}" });
                    }
                }

                // Remove old links
                if (user.Instruments.Any())
                {
                    _context.UserInstruments.RemoveRange(user.Instruments);
                }

                // Add new links — first one marked as primary
                user.Instruments = requestedIds
                    .Select((id, index) => new UserInstrument
                    {
                        UserId = user.Id,
                        InstrumentId = id,
                        IsPrimary = index == 0
                    })
                    .ToList();

                // Sync legacy single-instrument field for backward compatibility
                user.PreferredInstrumentId = requestedIds.FirstOrDefault() == 0 ? null : requestedIds.First();
            }
            else if (request.PreferredInstrumentId.HasValue)
            {
                // Backward compat: single instrument id
                user.PreferredInstrumentId = request.PreferredInstrumentId.Value;
            }

            // 2. "Other" instrument free text
            if (request.OtherInstrumentName != null)
            {
                user.OtherInstrumentName = string.IsNullOrWhiteSpace(request.OtherInstrumentName)
                    ? null
                    : request.OtherInstrumentName.Trim();
            }

            // 3. Instrument level (general)
            if (request.InstrumentLevel.HasValue)
            {
                if (Enum.IsDefined(typeof(InstrumentLevel), request.InstrumentLevel.Value))
                {
                    user.InstrumentLevel = (InstrumentLevel)request.InstrumentLevel.Value;
                }
            }

            // 4. Phone (legacy field — initial-completion may still send it)
            if (!string.IsNullOrEmpty(request.Phone))
            {
                user.Phone = request.Phone;
            }

            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(BuildUserDto(user, hasProfessionalProfile));
        }

        /// <summary>
        /// עדכון פרטי פרופיל "רכים" — נשלח מתזכורת לאחר זמן.
        /// כל השדות אופציונליים — נשמרים רק אלה שנשלחו (חלקי).
        /// </summary>
        [Authorize]
        [HttpPut("update-soft-profile")]
        public async Task<ActionResult<UserDto>> UpdateSoftProfile([FromBody] UpdateSoftProfileRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "משתמש לא מזוהה" });
            }

            var user = await _context.Users
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "משתמש לא נמצא" });
            }

            if (request.Phone != null)
            {
                user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
            }

            if (request.CityId.HasValue)
            {
                user.CityId = request.CityId.Value;
            }

            if (request.Address != null)
            {
                user.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
            }

            // Birth date — store as YYYY-MM-01 (day intentionally fixed; we only collect month+year)
            if (request.BirthMonth.HasValue && request.BirthYear.HasValue)
            {
                user.BirthDate = new DateTime(request.BirthYear.Value, request.BirthMonth.Value, 1);
            }

            // Mark reminder as resolved (so we don't keep nagging immediately after they updated)
            user.LastProfileReminderAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(BuildUserDto(user, hasProfessionalProfile));
        }

        /// <summary>
        /// עדכון הסכמה לקבלת דיוור פרסומי במייל.
        /// </summary>
        [Authorize]
        [HttpPut("marketing-consent")]
        public async Task<ActionResult<UserDto>> UpdateMarketingConsent([FromBody] MarketingConsentRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "משתמש לא מזוהה" });
            }

            var user = await _context.Users
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            if (user == null)
            {
                return NotFound(new { message = "משתמש לא נמצא" });
            }

            if (request.MarketingConsent)
            {
                user.MarketingConsent = true;
                user.MarketingConsentAt = DateTime.UtcNow;
                user.MarketingConsentRevokedAt = null;
                user.MarketingConsentSource = "profile";
            }
            else
            {
                user.MarketingConsent = false;
                user.MarketingConsentRevokedAt = DateTime.UtcNow;
            }

            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(BuildUserDto(user, hasProfessionalProfile));
        }

        /// <summary>
        /// המשתמש לחץ "אזכיר לי בפעם אחרת" בתזכורת.
        /// מעדכן את LastProfileReminderAt ומעלה את מונה הדחיות.
        /// </summary>
        [Authorize]
        [HttpPost("dismiss-profile-reminder")]
        public async Task<IActionResult> DismissProfileReminder()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "משתמש לא מזוהה" });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "משתמש לא נמצא" });
            }

            user.LastProfileReminderAt = DateTime.UtcNow;
            user.ProfileReminderDismissCount++;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                lastProfileReminderAt = user.LastProfileReminderAt,
                profileReminderDismissCount = user.ProfileReminderDismissCount
            });
        }

        [HttpPost("request-password-reset")]
        public async Task<IActionResult> RequestPasswordReset([FromBody] RequestPasswordResetRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Find user
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.UsernameOrEmail || u.Email == request.UsernameOrEmail);

            if (user == null)
            {
                // For security, don't reveal if user exists
                return Ok(new { message = "אם המשתמש קיים, קוד אימות נשלח" });
            }

            // Check if user has email/phone based on method
            if (request.Method == "email" && string.IsNullOrEmpty(user.Email))
            {
                return BadRequest(new { message = "למשתמש אין כתובת אימייל רשומה" });
            }

            if (request.Method == "sms" && string.IsNullOrEmpty(user.Phone))
            {
                return BadRequest(new { message = "למשתמש אין מספר טלפון רשום" });
            }

            // Clean up expired codes before adding a new one (prevents memory leak)
            var expiredKeys = _verificationCodes
                .Where(kv => kv.Value.Expiry < DateTime.UtcNow)
                .Select(kv => kv.Key)
                .ToList();
            foreach (var expiredKey in expiredKeys)
            {
                _verificationCodes.Remove(expiredKey);
                _resetAttempts.Remove(expiredKey);
            }

            // Generate cryptographically secure 6-digit code
            var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            // Store code with expiry (15 minutes) and reset attempt counter
            var key = user.Email.ToLower();
            _verificationCodes[key] = (code, DateTime.UtcNow.AddMinutes(15));
            _resetAttempts[key] = 0;

            if (request.Method == "email")
            {
                var sent = await _emailService.SendPasswordResetEmailAsync(user.Email, user.Username, code);
                if (!sent)
                {
                    _logger.LogError("Password reset email failed to send: UserId={UserId} IP={IP}",
                        user.Id, HttpContext.Connection.RemoteIpAddress);
                    return StatusCode(500, new { message = "שגיאה בשליחת המייל, נסה שוב מאוחר יותר" });
                }
            }

            _logger.LogInformation("Password reset code sent: UserId={UserId} Method={Method} IP={IP}",
                user.Id, request.Method, HttpContext.Connection.RemoteIpAddress);
            return Ok(new { message = "קוד אימות נשלח למייל" });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Find user
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.UsernameOrEmail || u.Email == request.UsernameOrEmail);

            if (user == null)
            {
                return BadRequest(new { message = "משתמש לא נמצא" });
            }

            // Verify code
            var key = user.Email.ToLower();
            if (!_verificationCodes.ContainsKey(key))
            {
                return BadRequest(new { message = "קוד אימות לא תקין או פג תוקפו" });
            }

            // Enforce attempt limit (brute-force protection)
            _resetAttempts.TryGetValue(key, out var attempts);
            if (attempts >= MaxResetAttempts)
            {
                _verificationCodes.Remove(key);
                _resetAttempts.Remove(key);
                _logger.LogWarning("Password reset blocked — too many attempts: UserId={UserId} IP={IP}",
                    user.Id, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "חריגה ממספר הניסיונות המותרים. אנא בקש קוד חדש" });
            }

            var (storedCode, expiry) = _verificationCodes[key];

            if (DateTime.UtcNow > expiry)
            {
                _verificationCodes.Remove(key);
                _resetAttempts.Remove(key);
                return BadRequest(new { message = "קוד האימות פג תוקפו. אנא בקש קוד חדש" });
            }

            if (storedCode != request.VerificationCode)
            {
                _resetAttempts[key] = attempts + 1;
                return BadRequest(new { message = "קוד אימות שגוי" });
            }

            // Update password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Remove used code and attempt counter
            _verificationCodes.Remove(key);
            _resetAttempts.Remove(key);

            _logger.LogInformation("Password reset completed: UserId={UserId} IP={IP}",
                user.Id, HttpContext.Connection.RemoteIpAddress);
            return Ok(new { message = "הסיסמא שונתה בהצלחה" });
        }

        // הורדת תמונת פרופיל מ-Google ושמירה ב-Azure Blob
        // מחזיר URL של Azure, או null אם נכשל (במקרה כזה נשמר ה-Google URL כגיבוי)
        private async Task<string?> UploadGoogleProfileImageAsync(string googleImageUrl)
        {
            try
            {
                var imageBytes = await _httpClient.GetByteArrayAsync(googleImageUrl);
                using var stream = new MemoryStream(imageBytes);
                return await _blobService.UploadAsync(stream, "profile.jpg", "image/jpeg", "profile-images");
            }
            catch
            {
                return null;
            }
        }

        // Helper class for Google response
        private class GoogleTokenInfo
        {
            public string Sub { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Picture { get; set; } = string.Empty;
        }
    }
}
