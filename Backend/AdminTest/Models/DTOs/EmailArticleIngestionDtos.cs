using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace AkordishKeit.Models.DTOs;

public sealed class EmailArticleIngestionRequestDto
{
    [Required]
    [StringLength(500)]
    public string Sender { get; set; } = string.Empty;

    [StringLength(500)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string MessageId { get; set; } = string.Empty;

    public string PlainBody { get; set; } = string.Empty;

    public string? HtmlBody { get; set; }

    public IFormFile? AudioFile { get; set; }
}

public sealed class EmailArticleIngestionResponseDto
{
    public bool Success { get; set; }
    public bool Duplicate { get; set; }
    public bool RequiresReview { get; set; }
    public int? ArticleId { get; set; }
    public string? Title { get; set; }
    public List<string> Warnings { get; set; } = new();
}
