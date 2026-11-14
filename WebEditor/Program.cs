using WebEditor.Components;
using WebEditor.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 512 * 1024;
});

builder.Services.Configure<ArticleServiceOptions>(
    builder.Configuration.GetSection(ArticleServiceOptions.SectionName));
builder.Services.Configure<StorageServiceOptions>(
    builder.Configuration.GetSection(StorageServiceOptions.SectionName));
builder.Services.AddHttpClient<StorageServiceClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<StorageServiceOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
});

builder.Services
    .AddHttpClient<IArticleService, ArticleServiceClient>((serviceProvider, client) =>
    {
        var options = serviceProvider
            .GetRequiredService<Microsoft.Extensions.Options.IOptions<ArticleServiceOptions>>()
            .Value;

        var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
            ? ArticleServiceOptions.DefaultBaseUrl
            : options.BaseUrl;

        client.BaseAddress = new Uri(baseUrl, UriKind.Absolute);
    });

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAntiforgery();

app.MapGet("/storage/images/{id:guid}", async (Guid id, StorageServiceClient storage, HttpContext context) =>
{
    using var response = await storage.GetImageAsync(id, context.RequestAborted);
    if (!response.IsSuccessStatusCode)
    {
        context.Response.StatusCode = (int)response.StatusCode;
        return;
    }

    var contentType = response.Content.Headers.ContentType?.MediaType;
    if (!StorageServiceClient.IsSupportedImageType(contentType))
    {
        context.Response.StatusCode = StatusCodes.Status415UnsupportedMediaType;
        return;
    }

    context.Response.ContentType = contentType;
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.ContentSecurityPolicy = "sandbox";
    await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
});

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

public partial class Program
{
}