namespace AkordishKeit.Services;

/// <summary>
/// Version tokens for public content caches. Changing a token makes existing
/// cache entries unreachable without deleting or rewriting persisted content.
/// </summary>
public class ContentExposureCacheVersion
{
    private long _articleVersion;

    public long ArticleVersion => Interlocked.Read(ref _articleVersion);

    public void InvalidateArticles()
    {
        Interlocked.Increment(ref _articleVersion);
    }
}
