using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ICsrfTokenService _csrfTokenService; // 🔐 שירות CSRF
        private readonly Cloudinary _cloudinary;

        // Simple in-memory storage for verification codes (in production, use Redis or database)
        private static readonly Dictionary<string, (string Code, DateTime Expiry)> _verificationCodes = new();

        public AuthController(
            AkordishKeitDbContext context,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ICsrfTokenService csrfTokenService) // 🔐 הזרקת שירות CSRF
        {
            _context = context;
            _httpClient = httpClientFactory.CreateClient();
            _configuration = configuration;
            _csrfTokenService = csrfTokenService;

            var account = new Account(
                configuration["Cloudinary:CloudName"],
                configuration["Cloudinary:ApiKey"],
                configuration["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
            _cloudinary.Api.Secure = true;
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
                return Unauthorized("Invalid Google Token");
            }

            // 2. Check if user exists (including professional profiles for onboarding check)
            var user = await _context.Users
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Email == googleUser.Email);

            bool isNewGoogleUser = user == null;

            // שמירת תמונת פרופיל ב-Cloudinary (במקום URL ישיר מ-Google שעלול להשתנות)
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
                user.LastLoginAt = DateTime.UtcNow;
                user.VisitCount++;
                await _context.SaveChangesAsync();
            }

            // 4. 🔐 שימוש באימות מאובטח עם Cookies
            // הרשמה חדשה = הצג שאלות onboarding; כניסה חוזרת = אל תציג
            var hasProfessionalProfile = user.ServiceProviderProfiles.Any() || user.ManagedArtist != null;
            return Ok(HandleSecureAuthentication(user, hasProfessionalProfile, isNewRegistration: isNewGoogleUser));
        }

        private async Task<GoogleTokenInfo?> VerifyGoogleToken(string idToken)
        {
            try
            {
                var response = await _httpClient.GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={idToken}");
                if (!response.IsSuccessStatusCode)
                    return null;

                var content = await response.Content.ReadAsStringAsync();
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

            var claims = new[]
            {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role.ToString()),
        new Claim("id", user.Id.ToString())
    };

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

            return new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                ProfileImageUrl = user.ProfileImageUrl,
                Role = user.Role.ToString(),
                Level = user.Level,
                Points = user.Points,
                PreferredInstrumentId = user.PreferredInstrumentId,
                Instruments = instruments,
                OtherInstrumentName = user.OtherInstrumentName,
                InstrumentLevel = user.InstrumentLevel.HasValue ? (int)user.InstrumentLevel.Value : (int?)null,
                Phone = user.Phone,
                Address = user.Address,
                CityId = user.CityId,
                BirthDate = user.BirthDate,
                HasProfessionalProfile = hasProfessionalProfile,
                ContentTag = (int)user.ContentTag,
                UploadCount = user.UploadCount,
                CreatedAt = user.CreatedAt,
                LastProfileReminderAt = user.LastProfileReminderAt,
                ProfileReminderDismissCount = user.ProfileReminderDismissCount,
                VisitCount = user.VisitCount
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

            // 1. Check if username already exists
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
            {
                return BadRequest(new { message = "שם המשתמש כבר קיים במערכת" });
            }

            // 2. Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
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
                Role = UserRole.Regular,
                Level = 1,
                Points = 0,
                IsActive = true,
                EmailConfirmed = false, // Will need email confirmation
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

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
                .Include(u => u.ServiceProviderProfiles)
                .Include(u => u.ManagedArtist)
                .Include(u => u.Instruments)
                    .ThenInclude(ui => ui.Instrument)
                .FirstOrDefaultAsync(u => u.Username == request.UsernameOrEmail || u.Email == request.UsernameOrEmail);

            if (user == null)
            {
                return Unauthorized(new { message = "שם משתמש או סיסמא שגויים" });
            }

            // 2. Check if user has password (not Google-only account)
            if (string.IsNullOrEmpty(user.PasswordHash))
            {
                return BadRequest(new { message = "משתמש זה נרשם דרך Google. אנא השתמש בכפתור 'כניסה עם Google'" });
            }

            // 3. Verify password
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "שם משתמש או סיסמא שגויים" });
            }

            // 4. Check if user is active
            if (!user.IsActive)
            {
                return Unauthorized(new { message = "החשבון הושעה. אנא צור קשר עם התמיכה" });
            }

            // 5. Update last login
            user.LastLoginAt = DateTime.UtcNow;
            user.VisitCount++;
            await _context.SaveChangesAsync();

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

            // Generate 6-digit verification code
            var random = new Random();
            var code = random.Next(100000, 999999).ToString();

            // Store code with expiry (15 minutes)
            var key = user.Email.ToLower();
            _verificationCodes[key] = (code, DateTime.UtcNow.AddMinutes(15));

            // TODO: Send verification code via email or SMS
            // For now, just log it (in production, implement actual email/SMS sending)
            Console.WriteLine($"=== PASSWORD RESET CODE ===");
            Console.WriteLine($"User: {user.Username} ({user.Email})");
            Console.WriteLine($"Code: {code}");
            Console.WriteLine($"Method: {request.Method}");
            Console.WriteLine($"Expires: {DateTime.UtcNow.AddMinutes(15):yyyy-MM-dd HH:mm:ss} UTC");
            Console.WriteLine($"===========================");

            if (request.Method == "email")
            {
                // TODO: Implement email sending service
                // await _emailService.SendPasswordResetEmail(user.Email, code);
            }
            else if (request.Method == "sms")
            {
                // TODO: Implement SMS sending service
                // await _smsService.SendPasswordResetSMS(user.Phone, code);
            }

            return Ok(new { message = "קוד אימות נשלח בהצלחה" });
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

            var (storedCode, expiry) = _verificationCodes[key];

            if (DateTime.UtcNow > expiry)
            {
                _verificationCodes.Remove(key);
                return BadRequest(new { message = "קוד האימות פג תוקפו. אנא בקש קוד חדש" });
            }

            if (storedCode != request.VerificationCode)
            {
                return BadRequest(new { message = "קוד אימות שגוי" });
            }

            // Update password
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Remove used code
            _verificationCodes.Remove(key);

            return Ok(new { message = "הסיסמא שונתה בהצלחה" });
        }

        // הורדת תמונת פרופיל מ-Google ושמירה ב-Cloudinary
        // מחזיר URL של Cloudinary, או null אם נכשל (במקרה כזה נשמר ה-Google URL כגיבוי)
        private async Task<string?> UploadGoogleProfileImageAsync(string googleImageUrl)
        {
            try
            {
                var imageBytes = await _httpClient.GetByteArrayAsync(googleImageUrl);
                using var stream = new MemoryStream(imageBytes);

                var uploadResult = await _cloudinary.UploadAsync(new ImageUploadParams
                {
                    File = new FileDescription("profile.jpg", stream),
                    PublicId = $"profile-images/{Guid.NewGuid()}",
                    Overwrite = false,
                    Transformation = new Transformation().Width(200).Height(200).Crop("fill").Gravity("face")
                });

                return uploadResult.Error == null ? uploadResult.SecureUrl.ToString() : null;
            }
            catch
            {
                return null;
            }
        }

        // Helper class for Google response
        private class GoogleTokenInfo
        {
            public string Sub { get; set; }
            public string Email { get; set; }
            public string Name { get; set; }
            public string Picture { get; set; }
        }
    }
}
