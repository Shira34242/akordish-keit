using System.Net;
using System.Text.Json;

namespace AkordishKeit.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unhandled exception on {Method} {Path} — {ExceptionType}: {ExceptionMessage}",
                context.Request.Method,
                context.Request.Path,
                ex.GetType().Name,
                ex.Message);

            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                context.Response.ContentType = "application/json";
                var isAgencyPath = context.Request.Path.Value?.Contains("/Agencies", StringComparison.OrdinalIgnoreCase) == true;
                await context.Response.WriteAsync(
                    JsonSerializer.Serialize(new { message = "שגיאת שרת פנימית", type = ex.GetType().Name, detail = ex.Message, stack = isAgencyPath ? ex.StackTrace?.Split('\n').Take(5) : null }));
            }
        }
    }
}
