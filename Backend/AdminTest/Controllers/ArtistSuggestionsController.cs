using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class ArtistSuggestionsController : ControllerBase
{
    private readonly IArtistSuggestionService _artistSuggestionService;

    public ArtistSuggestionsController(IArtistSuggestionService artistSuggestionService)
    {
        _artistSuggestionService = artistSuggestionService;
    }

    [HttpPost]
    public async Task<ActionResult<List<ArtistSuggestionDto>>> SuggestArtists([FromBody] ArtistSuggestionRequestDto request)
    {
        return Ok(await _artistSuggestionService.SuggestArtistsAsync(request));
    }
}
