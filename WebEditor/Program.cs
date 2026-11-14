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

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

public partial class Program
{
}