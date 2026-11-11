using System.Net.Http.Json;
using WebEditor.Models;

namespace WebEditor.Services;

public sealed class ArticleServiceClient(HttpClient httpClient) : IArticleService
{
    public async Task<List<ArticleModel>> GetArticlesAsync(Guid? tenantId = null, CancellationToken cancellationToken = default)
    {
        var path = "/api/Articles";

        if (tenantId.HasValue)
        {
            path = $"{path}?tenantId={tenantId.Value:D}";
        }

        var response = await httpClient.GetAsync(path, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"ArticleService list failed with {(int)response.StatusCode} ({response.StatusCode}). Body: {errorBody}");
        }

        var articles = await response.Content.ReadFromJsonAsync<List<ArticleModel>>(cancellationToken);

        return articles ?? [];
    }

    public async Task<ArticleModel> GetArticleAsync(long id, CancellationToken cancellationToken = default)
    {
        var response = await httpClient.GetAsync($"/api/Articles/{id}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"ArticleService get failed with {(int)response.StatusCode} ({response.StatusCode}). Body: {errorBody}");
        }

        var article = await response.Content.ReadFromJsonAsync<ArticleModel>(cancellationToken);

        return article ?? throw new InvalidOperationException("ArticleService returned an empty article response.");
    }

    public async Task<ArticleModel> CreateArticleAsync(
        ArticleCreateModel article,
        CancellationToken cancellationToken = default)
    {
        var response = await httpClient.PostAsJsonAsync(
            "/api/Articles",
            article,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"ArticleService create failed with {(int)response.StatusCode} ({response.StatusCode}). Body: {errorBody}");
        }

        var created = await response.Content.ReadFromJsonAsync<ArticleModel>(cancellationToken);

        return created ?? throw new InvalidOperationException("ArticleService returned an empty response.");
    }
}
