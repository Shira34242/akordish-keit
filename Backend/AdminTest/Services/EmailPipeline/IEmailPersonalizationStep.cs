namespace AkordishKeit.Services.EmailPipeline;

public interface IEmailPersonalizationStep
{
    string Apply(string html, Dictionary<string, string> variables);
}
