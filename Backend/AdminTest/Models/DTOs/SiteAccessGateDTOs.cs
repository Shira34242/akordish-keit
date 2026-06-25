using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class SiteAccessGateStatusDto
{
    public bool Enabled { get; set; }
    public bool PasswordConfigured { get; set; }
    public bool HasAccess { get; set; }
    public string AccessVersion { get; set; } = string.Empty;
}

public class VerifySiteAccessGateDto
{
    [Required(ErrorMessage = "סיסמה היא שדה חובה")]
    public string Password { get; set; } = string.Empty;
}

public class UpdateSiteAccessGateDto
{
    public bool Enabled { get; set; }

    [StringLength(100, MinimumLength = 4, ErrorMessage = "סיסמה חייבת להיות לפחות 4 תווים")]
    public string? Password { get; set; }
}
