using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class CreateComingSoonSubscriptionDto
{
    [Required]
    [EmailAddress]
    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;
}

public class ComingSoonSubscriptionDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
}
