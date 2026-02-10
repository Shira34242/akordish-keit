using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Instrument
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? EnglishName { get; set; }

    // Navigation
    public virtual ICollection<User> Users { get; set; }
}