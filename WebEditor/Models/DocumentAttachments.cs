namespace WebEditor.Models;

public static class DocumentAttachments
{
    public static List<Guid> GetIds(DocumentModel document)
    {
        var ids = new HashSet<Guid>();
        foreach (var block in document.Blocks)
        {
            if (!string.Equals(block.Type, "attachment", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(block.AttachmentId))
            {
                continue;
            }

            if (!Guid.TryParse(block.AttachmentId, out var id) || id == Guid.Empty)
            {
                throw new InvalidOperationException($"Invalid attachment ID: {block.AttachmentId}");
            }

            ids.Add(id);
        }

        return [.. ids];
    }
}
