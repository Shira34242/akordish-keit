namespace AkordishKeit.Models.Entities
{
    public class TeacherTestimonial
    {
        public int Id { get; set; }
        public int TeacherId { get; set; }
        public string? StudentName { get; set; }
        public string Text { get; set; } = string.Empty;
        public int Order { get; set; }

        public virtual Teacher Teacher { get; set; } = null!;
    }
}
