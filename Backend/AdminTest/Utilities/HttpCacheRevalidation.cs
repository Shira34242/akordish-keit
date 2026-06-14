using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Utilities;

public static class HttpCacheRevalidation
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static ActionResult<T> Revalidate<T>(ControllerBase controller, T content)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(content, SerializerOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(bytes))}\"";

        controller.Response.Headers.CacheControl = "public, no-cache";
        controller.Response.Headers.ETag = etag;

        if (controller.Request.Headers.IfNoneMatch.ToString().Split(',').Any(candidate =>
                string.Equals(candidate.Trim(), etag, StringComparison.Ordinal)))
        {
            return controller.StatusCode(StatusCodes.Status304NotModified);
        }

        return controller.Ok(content);
    }
}
