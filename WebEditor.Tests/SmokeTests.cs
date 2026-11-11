using Microsoft.AspNetCore.Mvc.Testing;

namespace WebEditor.Tests;

public class SmokeTests
{
    [Fact]
    public async Task Home_contains_expected_content()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/");
        var html = await response.Content.ReadAsStringAsync();

        Assert.True(response.IsSuccessStatusCode);
        Assert.Contains("Articles", html, StringComparison.OrdinalIgnoreCase);
    }
}
