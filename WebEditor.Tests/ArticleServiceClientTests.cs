using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using WebEditor.Models;
using WebEditor.Services;

namespace WebEditor.Tests;

public class ArticleServiceClientTests
{
    [Fact]
    public async Task CreateArticleAsync_posts_payload_and_returns_created_article()
    {
        var expected = new ArticleModel
        {
            Id = 42,
            TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Title = "Saved"
        };

        var handler = new StubHttpMessageHandler(_ =>
        {
            var json = JsonSerializer.Serialize(expected);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });

        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://localhost:32769") };
        var service = new ArticleServiceClient(httpClient);
        var request = new ArticleCreateModel
        {
            TenantId = expected.TenantId,
            Title = "Draft",
            Content = "{}"
        };

        var saved = await service.CreateArticleAsync(request);
        var postedJson = await handler.LastRequest!.Content!.ReadAsStringAsync();

        Assert.Equal("/api/Articles", handler.LastRequest?.RequestUri?.AbsolutePath);
        Assert.Equal(HttpMethod.Post, handler.LastRequest?.Method);
        Assert.DoesNotContain("\"id\"", postedJson, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(42, saved.Id);
        Assert.Equal("Saved", saved.Title);
    }

    [Fact]
    public async Task GetArticlesAsync_with_tenantId_uses_query_and_returns_items()
    {
        var expectedTenant = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        var handler = new StubHttpMessageHandler(_ =>
        {
            var json = "[{\"id\":10,\"title\":\"A\",\"referCount\":3,\"dateUpdated\":\"2026-11-10T00:00:00Z\"}]";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });

        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:32768") };
        var service = new ArticleServiceClient(httpClient);

        var list = await service.GetArticlesAsync(expectedTenant);

        Assert.Equal(HttpMethod.Get, handler.LastRequest?.Method);
        Assert.Equal("/api/Articles", handler.LastRequest?.RequestUri?.AbsolutePath);
        Assert.Contains($"tenantId={expectedTenant:D}", handler.LastRequest?.RequestUri?.Query, StringComparison.OrdinalIgnoreCase);
        Assert.Single(list);
        Assert.Equal(10, list[0].Id);
    }

    [Fact]
    public async Task GetArticleAsync_uses_id_path_and_returns_article()
    {
        var handler = new StubHttpMessageHandler(_ =>
        {
            var json = "{\"id\":10,\"title\":\"A\",\"content\":\"{}\",\"dateUpdated\":\"2026-11-10T00:00:00Z\"}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });

        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:32768") };
        var service = new ArticleServiceClient(httpClient);

        var article = await service.GetArticleAsync(10);

        Assert.Equal(HttpMethod.Get, handler.LastRequest?.Method);
        Assert.Equal("/api/Articles/10", handler.LastRequest?.RequestUri?.AbsolutePath);
        Assert.Equal(10, article.Id);
    }

    private sealed class StubHttpMessageHandler(
        Func<HttpRequestMessage, HttpResponseMessage> responseFactory) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(responseFactory(request));
        }
    }
}
