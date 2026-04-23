namespace AkordishKeit.Models.Entities
{
    public class MusicServiceProviderTestimonial
    {
        public int Id { get; set; }
        public int ServiceProviderId { get; set; }
        public string? ClientName { get; set; }
        public string Text { get; set; } = string.Empty;
        public int Order { get; set; }

        public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;
    }
}
