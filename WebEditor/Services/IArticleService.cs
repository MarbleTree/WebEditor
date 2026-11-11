using WebEditor.Models;

namespace WebEditor.Services;

public interface IArticleService
{
    Task<List<ArticleModel>> GetArticlesAsync(Guid? tenantId = null, CancellationToken cancellationToken = default);

    Task<ArticleModel> GetArticleAsync(long id, CancellationToken cancellationToken = default);

    Task<ArticleModel> CreateArticleAsync(ArticleCreateModel article, CancellationToken cancellationToken = default);
}
