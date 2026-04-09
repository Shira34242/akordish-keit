using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ISystemSettingsService
{
    /// <summary>קריאת ערך בוליאני. ברירת מחדל: false אם המפתח לא קיים.</summary>
    Task<bool> GetBoolAsync(string key, bool defaultValue = false);

    /// <summary>עדכון ערך הגדרה. מחזיר null אם המפתח לא נמצא.</summary>
    Task<SystemSettingDto?> UpdateAsync(string key, string value);

    /// <summary>כל ההגדרות (לממשק הניהול)</summary>
    Task<List<SystemSettingDto>> GetAllAsync();
}
