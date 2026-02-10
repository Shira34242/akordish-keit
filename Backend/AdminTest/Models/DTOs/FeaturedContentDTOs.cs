using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs
{
    /// <summary>
    /// DTO ליצירת תוכן מרכזי
    /// </summary>
    public class CreateFeaturedContentDto
    {
        [Required(ErrorMessage = "מזהה הכתבה הוא שדה חובה")]
        public int ArticleId { get; set; }

        [Required(ErrorMessage = "סדר התצוגה הוא שדה חובה")]
        [Range(1, 4, ErrorMessage = "סדר התצוגה חייב להיות בין 1 ל-4")]
        public int DisplayOrder { get; set; }

        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// DTO לעדכון תוכן מרכזי
    /// </summary>
    public class UpdateFeaturedContentDto
    {
        [Required(ErrorMessage = "מזהה הכתבה הוא שדה חובה")]
        public int ArticleId { get; set; }

        [Required(ErrorMessage = "סדר התצוגה הוא שדה חובה")]
        [Range(1, 4, ErrorMessage = "סדר התצוגה חייב להיות בין 1 ל-4")]
        public int DisplayOrder { get; set; }

        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// DTO להחזרת תוכן מרכזי עם פרטי הכתבה
    /// </summary>
    public class FeaturedContentDto
    {
        public int Id { get; set; }
        public int ArticleId { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }

        // פרטי הכתבה המקושרת
        public ArticleDto Article { get; set; } = null!;
    }

    /// <summary>
    /// DTO לעדכון מהיר של כל 4 הכתבות המרכזיות בבת אחת
    /// </summary>
    public class UpdateFeaturedContentBulkDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "חייב לבחור לפחות כתבה אחת")]
        [MaxLength(4, ErrorMessage = "ניתן לבחור עד 4 כתבות")]
        public List<FeaturedContentItemDto> Items { get; set; } = new();
    }

    public class FeaturedContentItemDto
    {
        [Required]
        public int ArticleId { get; set; }

        [Required]
        [Range(1, 4)]
        public int DisplayOrder { get; set; }
    }
}
