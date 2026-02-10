using AkordishKeit.Models.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CitiesController : ControllerBase
{
    /// <summary>
    /// מחזיר את רשימת כל הערים בישראל
    /// </summary>
    [HttpGet]
    public ActionResult<List<CityDto>> GetCities([FromQuery] string? search = null)
    {
        var cities = GetIsraeliCities();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            cities = cities.Where(c =>
                c.Name.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                (c.EnglishName != null && c.EnglishName.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                (c.District != null && c.District.Contains(search, StringComparison.OrdinalIgnoreCase))
            ).ToList();
        }

        return Ok(cities);
    }

    /// <summary>
    /// מחזיר עיר לפי ID
    /// </summary>
    [HttpGet("{id}")]
    public ActionResult<CityDto> GetCity(int id)
    {
        var city = GetIsraeliCities().FirstOrDefault(c => c.Id == id);

        if (city == null)
        {
            return NotFound();
        }

        return Ok(city);
    }

    /// <summary>
    /// רשימת ערים מרכזיות בישראל - ממוינות לפי חשיבות ואוכלוסייה
    /// </summary>
    private static List<CityDto> GetIsraeliCities()
    {
        return new List<CityDto>
        {
            new() { Id = 1, Name = "ירושלים", EnglishName = "Jerusalem", District = "ירושלים", Population = 936425, IsActive = true },
            new() { Id = 2, Name = "תל אביב-יפו", EnglishName = "Tel Aviv", District = "תל אביב", Population = 460613, IsActive = true },
            new() { Id = 3, Name = "חיפה", EnglishName = "Haifa", District = "חיפה", Population = 285316, IsActive = true },
            new() { Id = 4, Name = "ראשון לציון", EnglishName = "Rishon LeZion", District = "מרכז", Population = 254384, IsActive = true },
            new() { Id = 5, Name = "פתח תקווה", EnglishName = "Petah Tikva", District = "מרכז", Population = 247956, IsActive = true },
            new() { Id = 6, Name = "אשדוד", EnglishName = "Ashdod", District = "דרום", Population = 225939, IsActive = true },
            new() { Id = 7, Name = "נתניה", EnglishName = "Netanya", District = "מרכז", Population = 221353, IsActive = true },
            new() { Id = 8, Name = "באר שבע", EnglishName = "Beersheba", District = "דרום", Population = 209687, IsActive = true },
            new() { Id = 9, Name = "בני ברק", EnglishName = "Bnei Brak", District = "תל אביב", Population = 204639, IsActive = true },
            new() { Id = 10, Name = "חולון", EnglishName = "Holon", District = "תל אביב", Population = 196282, IsActive = true },
            new() { Id = 11, Name = "רמת גן", EnglishName = "Ramat Gan", District = "תל אביב", Population = 163480, IsActive = true },
            new() { Id = 12, Name = "אשקלון", EnglishName = "Ashkelon", District = "דרום", Population = 144073, IsActive = true },
            new() { Id = 13, Name = "רחובות", EnglishName = "Rehovot", District = "מרכז", Population = 143904, IsActive = true },
            new() { Id = 14, Name = "בת ים", EnglishName = "Bat Yam", District = "תל אביב", Population = 129013, IsActive = true },
            new() { Id = 15, Name = "בית שמש", EnglishName = "Beit Shemesh", District = "ירושלים", Population = 124957, IsActive = true },
            new() { Id = 16, Name = "כפר סבא", EnglishName = "Kfar Saba", District = "מרכז", Population = 101432, IsActive = true },
            new() { Id = 17, Name = "הרצליה", EnglishName = "Herzliya", District = "תל אביב", Population = 97470, IsActive = true },
            new() { Id = 18, Name = "חדרה", EnglishName = "Hadera", District = "חיפה", Population = 97374, IsActive = true },
            new() { Id = 19, Name = "מודיעין-מכבים-רעות", EnglishName = "Modiin", District = "מרכז", Population = 93277, IsActive = true },
            new() { Id = 20, Name = "נצרת", EnglishName = "Nazareth", District = "צפון", Population = 77445, IsActive = true },
            new() { Id = 21, Name = "רמלה", EnglishName = "Ramla", District = "מרכז", Population = 78014, IsActive = true },
            new() { Id = 22, Name = "לוד", EnglishName = "Lod", District = "מרכז", Population = 77223, IsActive = true },
            new() { Id = 23, Name = "רעננה", EnglishName = "Raanana", District = "מרכז", Population = 75461, IsActive = true },
            new() { Id = 24, Name = "הוד השרון", EnglishName = "Hod Hasharon", District = "מרכז", Population = 66482, IsActive = true },
            new() { Id = 25, Name = "ראש העין", EnglishName = "Rosh Haayin", District = "מרכז", Population = 64910, IsActive = true },
            new() { Id = 26, Name = "גבעתיים", EnglishName = "Givatayim", District = "תל אביב", Population = 61924, IsActive = true },
            new() { Id = 27, Name = "קריית אתא", EnglishName = "Kiryat Ata", District = "חיפה", Population = 60532, IsActive = true },
            new() { Id = 28, Name = "קריית גת", EnglishName = "Kiryat Gat", District = "דרום", Population = 57713, IsActive = true },
            new() { Id = 29, Name = "נהריה", EnglishName = "Nahariya", District = "צפון", Population = 56235, IsActive = true },
            new() { Id = 30, Name = "אום אל-פחם", EnglishName = "Umm al-Fahm", District = "חיפה", Population = 56109, IsActive = true },
            new() { Id = 31, Name = "נס ציונה", EnglishName = "Ness Ziona", District = "מרכז", Population = 52688, IsActive = true },
            new() { Id = 32, Name = "אילת", EnglishName = "Eilat", District = "דרום", Population = 52753, IsActive = true },
            new() { Id = 33, Name = "אלעד", EnglishName = "Elad", District = "מרכז", Population = 50347, IsActive = true },
            new() { Id = 34, Name = "עכו", EnglishName = "Acre", District = "צפון", Population = 49614, IsActive = true },
            new() { Id = 35, Name = "רמת השרון", EnglishName = "Ramat Hasharon", District = "תל אביב", Population = 46878, IsActive = true },
            new() { Id = 36, Name = "כרמיאל", EnglishName = "Karmiel", District = "צפון", Population = 46706, IsActive = true },
            new() { Id = 37, Name = "יבנה", EnglishName = "Yavne", District = "מרכז", Population = 45696, IsActive = true },
            new() { Id = 38, Name = "טייבה", EnglishName = "Tayibe", District = "מרכז", Population = 44262, IsActive = true },
            new() { Id = 39, Name = "טבריה", EnglishName = "Tiberias", District = "צפון", Population = 44186, IsActive = true },
            new() { Id = 40, Name = "שפרעם", EnglishName = "Shfaram", District = "צפון", Population = 43543, IsActive = true },
            new() { Id = 41, Name = "מעלה אדומים", EnglishName = "Maaleh Adumim", District = "ירושלים", Population = 41463, IsActive = true },
            new() { Id = 42, Name = "קריית מוצקין", EnglishName = "Kiryat Motzkin", District = "חיפה", Population = 41148, IsActive = true },
            new() { Id = 43, Name = "קריית ים", EnglishName = "Kiryat Yam", District = "חיפה", Population = 40628, IsActive = true },
            new() { Id = 44, Name = "קריית ביאליק", EnglishName = "Kiryat Bialik", District = "חיפה", Population = 40360, IsActive = true },
            new() { Id = 45, Name = "אור יהודה", EnglishName = "Or Yehuda", District = "תל אביב", Population = 37134, IsActive = true },
            new() { Id = 46, Name = "קריית אונו", EnglishName = "Kiryat Ono", District = "תל אביב", Population = 36784, IsActive = true },
            new() { Id = 47, Name = "נתיבות", EnglishName = "Netivot", District = "דרום", Population = 36215, IsActive = true },
            new() { Id = 48, Name = "צפת", EnglishName = "Safed", District = "צפון", Population = 35208, IsActive = true },
            new() { Id = 49, Name = "תמרה", EnglishName = "Tamra", District = "צפון", Population = 34794, IsActive = true },
            new() { Id = 50, Name = "דימונה", EnglishName = "Dimona", District = "דרום", Population = 34123, IsActive = true },
            new() { Id = 51, Name = "סח'נין", EnglishName = "Sakhnin", District = "צפון", Population = 31896, IsActive = true },
            new() { Id = 52, Name = "יהוד-מונוסון", EnglishName = "Yehud-Monosson", District = "מרכז", Population = 30083, IsActive = true },
            new() { Id = 53, Name = "אופקים", EnglishName = "Ofakim", District = "דרום", Population = 29483, IsActive = true },
            new() { Id = 54, Name = "טירה", EnglishName = "Tira", District = "מרכז", Population = 27241, IsActive = true },
            new() { Id = 55, Name = "שדרות", EnglishName = "Sderot", District = "דרום", Population = 27483, IsActive = true },
            new() { Id = 56, Name = "גדרה", EnglishName = "Gedera", District = "מרכז", Population = 27012, IsActive = true },
            new() { Id = 57, Name = "ערד", EnglishName = "Arad", District = "דרום", Population = 26763, IsActive = true },
            new() { Id = 58, Name = "מגדל העמק", EnglishName = "Migdal HaEmek", District = "צפון", Population = 24829, IsActive = true },
            new() { Id = 59, Name = "גן יבנה", EnglishName = "Gan Yavne", District = "מרכז", Population = 24389, IsActive = true },
            new() { Id = 60, Name = "שוהם", EnglishName = "Shoham", District = "מרכז", Population = 24342, IsActive = true },
            new() { Id = 61, Name = "יקנעם", EnglishName = "Yokneam", District = "צפון", Population = 23963, IsActive = true },
            new() { Id = 62, Name = "קריית שמונה", EnglishName = "Kiryat Shmona", District = "צפון", Population = 23673, IsActive = true },
            new() { Id = 63, Name = "קריית מלאכי", EnglishName = "Kiryat Malakhi", District = "דרום", Population = 23542, IsActive = true },
            new() { Id = 64, Name = "קלנסווה", EnglishName = "Qalansawe", District = "מרכז", Population = 23432, IsActive = true },
            new() { Id = 65, Name = "זכרון יעקב", EnglishName = "Zichron Yaakov", District = "חיפה", Population = 22591, IsActive = true },
            new() { Id = 66, Name = "מעלות-תרשיחא", EnglishName = "Maalot-Tarshiha", District = "צפון", Population = 21433, IsActive = true },
            new() { Id = 67, Name = "אריאל", EnglishName = "Ariel", District = "יהודה ושומרון", Population = 20540, IsActive = true },
            new() { Id = 68, Name = "בית שאן", EnglishName = "Beit Shean", District = "צפון", Population = 19437, IsActive = true },
            new() { Id = 69, Name = "מצפה רמון", EnglishName = "Mitzpe Ramon", District = "דרום", Population = 5314, IsActive = true }
        };
    }
}
