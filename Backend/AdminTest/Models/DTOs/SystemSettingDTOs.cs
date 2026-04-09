using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class SystemSettingDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class UpdateSystemSettingDto
{
    [Required(ErrorMessage = "ערך הוא שדה חובה")]
    public string Value { get; set; } = string.Empty;
}
