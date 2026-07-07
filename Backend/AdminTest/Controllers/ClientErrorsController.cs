using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClientErrorsController : ControllerBase
    {
        private readonly ILogger<ClientErrorsController> _logger;

        public ClientErrorsController(ILogger<ClientErrorsController> logger)
        {
            _logger = logger;
        }

        public record ClientErrorDto(
            string Message,
            string? Stack,
            string? Url,
            string? UserAgent
        );

        [HttpPost]
        public IActionResult LogError([FromBody] ClientErrorDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest();

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var msg = dto.Message.Length > 500 ? dto.Message[..500] : dto.Message;
            var stack = dto.Stack is { Length: > 0 }
                ? (dto.Stack.Length > 2000 ? dto.Stack[..2000] : dto.Stack)
                : null;

            _logger.LogWarning(
                "CLIENT_ERROR | IP={IP} | URL={Url} | Message={Message} | Stack={Stack}",
                ip, dto.Url, msg, stack);

            return Ok();
        }
    }
}
