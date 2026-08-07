using System.Text;
using System.Text.Json;
using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public class EmailPersonalizationStep : IEmailPersonalizationStep
{
    public string Apply(string html, Dictionary<string, string> variables)
    {
        if (variables.Count == 0) return html;

        var result = html;
        foreach (var (key, value) in variables)
        {
            var placeholder = $"{{{{{{key}}}}}}";
            var safeValue = System.Net.WebUtility.HtmlEncode(value);
            result = result.Replace(placeholder, safeValue);
        }

        return result;
    }
}
