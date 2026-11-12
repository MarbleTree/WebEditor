namespace WebEditor.Services;

public sealed class ArticleServiceOptions
{
    public const string SectionName = "ArticleService";
    internal const string DefaultBaseUrl = "https://localhost:32773";

    public string BaseUrl { get; set; } = DefaultBaseUrl;

    public Guid TenantId { get; set; } = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
}
