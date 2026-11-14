namespace WebEditor.Models;

public sealed class DocumentModel
{
    public string Schema { get; set; } = "we-content";

    public int Version { get; set; } = 1;

    public DocumentMeta Meta { get; set; } = new();

    public List<DocumentBlock> Blocks { get; set; } = [];
}

public sealed class DocumentMeta
{
    public string Title { get; set; } = "Untitled";

    public string Language { get; set; } = "en-US";
}

public sealed class DocumentBlock
{
    public string Id { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public int? Level { get; set; }

    public bool? Ordered { get; set; }

    public string? Align { get; set; }

    public List<DocumentRun>? Content { get; set; }

    public List<List<DocumentRun>>? Items { get; set; }

    public List<List<List<DocumentRun>>>? Rows { get; set; }

    public int? TableWidth { get; set; }

    public List<int>? ColumnWidths { get; set; }

    public List<int>? RowHeights { get; set; }

    public List<List<TableCellStyle?>>? CellStyles { get; set; }

    public List<List<TableCellMeta?>>? CellMeta { get; set; }

    public int? CellPadding { get; set; }

    public int? CellBorderWidth { get; set; }

    public string? CellBorderColor { get; set; }

    public string? AttachmentId { get; set; }

    public string? Src { get; set; }

    public string? Alt { get; set; }

    public int? ImageWidthPercent { get; set; }

    public string? ImageDisplay { get; set; }
}

public sealed class DocumentRun
{
    public string Text { get; set; } = string.Empty;

    public List<object>? Marks { get; set; }
}

public sealed class TableCellStyle
{
    public string? BackgroundColor { get; set; }

    public string? VerticalAlign { get; set; }
}

public sealed class TableCellMeta
{
    public int? ColSpan { get; set; }

    public int? RowSpan { get; set; }

    public bool? IsHeader { get; set; }
}
