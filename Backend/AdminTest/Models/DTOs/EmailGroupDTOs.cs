namespace AkordishKeit.Models.DTOs;

public class EmailGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MemberCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<EmailGroupMemberDto> Members { get; set; } = new();
}

public class EmailGroupMemberDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class SaveEmailGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<int> UserIds { get; set; } = new();
}

public class SiteInterestDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsReadOnly { get; set; }
}

public class RegisterSiteInterestDto
{
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }
}

public class EmailRecipientDto
{
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
}

public class EmailPreviewRequestDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
}
