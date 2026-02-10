using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities
{

    /// <summary>
    /// הגשת תוכן - קישור פשוט לשיר שנוצר
    /// </summary>
    public class ContentSubmission
    {
        public int Id { get; set; }
        public int SongId { get; set; }
        public SubmissionStatus Status { get; set; }
        public int SubmittedByUserId { get; set; }
        public DateTime SubmittedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? AdminNotes { get; set; }
        public string? RejectionReason { get; set; }
        public bool IsDeleted { get; set; }

        // Navigation Properties
        public virtual Song Song { get; set; }
        public virtual User SubmittedByUser { get; set; }
        public virtual User? ReviewedByUser { get; set; }
    }

}


