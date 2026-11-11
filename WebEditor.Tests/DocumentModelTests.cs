using WebEditor.Models;

namespace WebEditor.Tests;

public class DocumentModelTests
{
    [Fact]
    public void Constructor_sets_expected_defaults()
    {
        var document = new DocumentModel();

        Assert.Equal("we-content", document.Schema);
        Assert.Equal(1, document.Version);
        Assert.NotNull(document.Meta);
        Assert.Equal("Untitled", document.Meta.Title);
        Assert.Equal("en-US", document.Meta.Language);
        Assert.NotNull(document.Blocks);
        Assert.Empty(document.Blocks);
    }

    [Fact]
    public void Blocks_can_store_structured_content()
    {
        var document = new DocumentModel();
        var block = new DocumentBlock
        {
            Id = "b1",
            Type = "paragraph",
            Content =
            [
                new DocumentRun { Text = "Hello" }
            ]
        };

        document.Blocks.Add(block);

        Assert.Single(document.Blocks);
        Assert.Equal("b1", document.Blocks[0].Id);
        Assert.Equal("paragraph", document.Blocks[0].Type);
        Assert.NotNull(document.Blocks[0].Content);
        Assert.Equal("Hello", document.Blocks[0].Content![0].Text);
    }
}
