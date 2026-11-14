using Microsoft.AspNetCore.Components;

namespace WebEditor.Tests;

public class WebEditorComponentTests
{
    [Fact]
    public void InlineImageMaxBytes_defaults_to_50_kibibytes()
    {
        var component = new Components.WebEditor();

        Assert.Equal(50 * 1024, component.InlineImageMaxBytes);
    }

    [Fact]
    public async Task HandleDocumentChanged_without_callback_returns_completed_task()
    {
        var component = new Components.WebEditor();

        var task = component.HandleDocumentChanged("{\"version\":1}");

        await task;
        Assert.True(task.IsCompletedSuccessfully);
    }

    [Fact]
    public async Task HandleDocumentChanged_with_callback_invokes_callback()
    {
        var component = new Components.WebEditor();
        string? received = null;

        component.OnDocumentChanged = EventCallback.Factory.Create<string>(
            this,
            payload => received = payload);

        await component.HandleDocumentChanged("{\"version\":2}");

        Assert.Equal("{\"version\":2}", received);
    }
}
