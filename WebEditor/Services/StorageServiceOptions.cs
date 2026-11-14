namespace WebEditor.Services;

public sealed class StorageServiceOptions
{
    public const string SectionName = "StorageService";
    public string BaseUrl { get; set; } = "https://localhost:32805";
    public Guid TenantId { get; set; }
    public Guid AttachmentFolderId { get; set; }
    public long MaxImageBytes { get; set; } = 30 * 1024 * 1024;
}
