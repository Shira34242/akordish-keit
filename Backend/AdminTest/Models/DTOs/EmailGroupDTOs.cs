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
    public int SubscriberId { get; set; }
    public int? UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class SaveEmailGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<int> SubscriberIds { get; set; } = new();
}

public class EmailSubscriberDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int? UserId { get; set; }
    public bool IsSubscribed { get; set; }
    public string Source { get; set; } = string.Empty;
    public DateTime SubscribedAt { get; set; }
    public DateTime? UnsubscribedAt { get; set; }
    public List<EmailSubscriberGroupDto> Groups { get; set; } = new();
}

public class EmailSubscriberGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class EmailSubscriberPageDto
{
    public List<EmailSubscriberDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int SubscribedCount { get; set; }
    public int UnsubscribedCount { get; set; }
}

public class SaveEmailSubscriberDto
{
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
    public bool IsSubscribed { get; set; } = true;
    public List<int> GroupIds { get; set; } = new();
}

public class UpdateEmailSubscriberDto
{
    public string? Name { get; set; }
    public bool IsSubscribed { get; set; }
    public List<int> GroupIds { get; set; } = new();
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
