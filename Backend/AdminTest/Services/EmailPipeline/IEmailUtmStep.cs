namespace AkordishKeit.Services.EmailPipeline;

public interface IEmailUtmStep
{
    string Apply(string html, UtmSettings settings);
}

public class UtmSettings
{
    public bool Enabled { get; set; }
    public string Source { get; set; } = "akordishkayt";
    public string Medium { get; set; } = "email";
    public string Campaign { get; set; } = string.Empty;
    public string? Content { get; set; }
}
