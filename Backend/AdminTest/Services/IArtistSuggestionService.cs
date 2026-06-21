using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IArtistSuggestionService
{
    Task<List<ArtistSuggestionDto>> SuggestArtistsAsync(ArtistSuggestionRequestDto request);
}
