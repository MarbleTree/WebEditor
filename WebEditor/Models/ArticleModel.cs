namespace WebEditor.Models;

public sealed class ArticleModel
{
    public long Id { get; set; }

    public Guid TenantId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid? Author { get; set; }

    public string? Content { get; set; }

    public int ReferCount { get; set; }

    public DateTime DateCreated { get; set; }

    public DateTime DateUpdated { get; set; }

    public string? OptionalData { get; set; }

    public List<Guid>? Attachments { get; set; }
}
