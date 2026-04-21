namespace AkordishKeit.Services;

public interface IChordIndexService
{
    IReadOnlyList<ChordIndexItem> ExtractChords(string? lyricsWithChords);
    string NormalizeChordName(string chordName);
    Task SyncSongChordsAsync(int songId, string? lyricsWithChords);
    Task EnsureApprovedSongsIndexedAsync(int batchSize = 250);
}

public record ChordIndexItem(string DisplayChordName, string NormalizedChordName);
