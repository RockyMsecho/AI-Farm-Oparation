using System.Text;
using FarmManagement.API.Authorization;
using FarmManagement.API.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FarmManagement.API.Services;

var builder = WebApplication.CreateBuilder(args);


builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
options.UseSqlServer(
builder.Configuration.GetConnectionString("DefaultConnection")));


builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});


builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
});


var jwtKey = builder.Configuration["Jwt:Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException(
    "JWT Key is missing from appsettings.json.");
}

builder.Services.AddAuthentication(
JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,


        IssuerSigningKey =
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtKey)),

        ValidateIssuer = true,

        ValidIssuer =
                builder.Configuration["Jwt:Issuer"],

        ValidateAudience = true,

        ValidAudience =
                builder.Configuration["Jwt:Audience"],

        ValidateLifetime = true,

        ClockSkew = TimeSpan.Zero
    };
});



builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var configuredOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? Array.Empty<string>();

        if (configuredOrigins.Length == 0)
        {
            policy.SetIsOriginAllowed(origin => false);
        }
        else
        {
            policy.WithOrigins(configuredOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
    });
});


builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your JWT token. Example: Bearer {your token}"
    });


options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
{
    {
        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Reference = new Microsoft.OpenApi.Models.OpenApiReference
            {
                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        },
        Array.Empty<string>()
    }
});


});


var app = builder.Build();


using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    try
    {
        if (!await db.Database.CanConnectAsync())
        {
            throw new InvalidOperationException(
                "The API cannot connect to FarmManagementDB. Check that SQL Server LocalDB is running and that the DefaultConnection is correct.");
        }

        await RbacSeeder.SeedAsync(db);
    }
    catch (Exception ex)
    {
        throw new InvalidOperationException(
            "Database startup failed. The database schema may be missing or out of date. " +
            "Run RESET-DEV-DATABASE-AND-RUN.ps1 from the project root, or run: " +
            "dotnet ef database drop --force, dotnet ef migrations add InitialCreate, " +
            "dotnet ef database update. See SETUP-FIXED.md for details.", ex);
    }
}


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();


app.UseSwaggerUI();


}

var disableHttpsRedirect = string.Equals(
    builder.Configuration["AI_FARM_DISABLE_HTTPS_REDIRECT"],
    "true",
    StringComparison.OrdinalIgnoreCase);

if (!disableHttpsRedirect)
{
    app.UseHttpsRedirection();
}

app.UseRateLimiter();

app.UseDefaultFiles();
app.UseStaticFiles();


app.UseCors("AllowFrontend");


app.UseAuthentication();


app.UseAuthorization();


app.MapControllers();

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    service = "AI Farm API",
    timeUtc = DateTime.UtcNow
}));

app.MapFallbackToFile("auth.html");


app.Run();

