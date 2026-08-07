using System.Text.Json.Serialization;

namespace AkordishKeit.Models.Entities;

public class EventLookupEntry
{
    [JsonPropertyName("event")]
    public string Event { get; set; } = string.Empty;

    [JsonPropertyName("ts_epoch")]
    public long TsEpoch { get; set; }

    [JsonPropertyName("link")]
    public string? Link { get; set; }
}
