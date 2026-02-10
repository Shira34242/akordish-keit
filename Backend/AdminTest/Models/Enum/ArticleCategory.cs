using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.Enum;

public enum ArticleCategory
{
    [Display(Name = "כללי")]
    General = 1,

    [Display(Name = "חדשות")]
    News = 2,

    [Display(Name = "ביקורות")]
    Reviews = 3,

    [Display(Name = "ראיונות")]
    Interviews = 4,

    [Display(Name = "כתבות מיוחדות")]
    Features = 5,

    [Display(Name = "כתבות הופעות")]
    LiveReports = 6,

    [Display(Name = "ביקורות אלבומים")]
    AlbumReviews = 7,

    [Display(Name = "טכנולוגיה מוזיקלית")]
    MusicTech = 8,

    [Display(Name = "לימוד וחינוך")]
    Education = 9,

    [Display(Name = "פופולארי")]
    Popular = 10,

    [Display(Name = "קליפים")]
    Clips = 11,

    [Display(Name = "בלוג")]
    Blog = 12,

    [Display(Name = "דעה")]
    Opinion = 13,

    [Display(Name = "מצעדים")]
    Charts = 14,

    [Display(Name = "מאחורי הקלעים")]
    BehindTheScenes = 15
}
