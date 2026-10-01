using System.Net;
using System.Net.Mail;

namespace FarmManagement.API.Services
{
    public sealed class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken ct = default)
        {
            var host = _configuration["Email:SmtpHost"];
            var portText = _configuration["Email:SmtpPort"];
            var username = _configuration["Email:Username"];
            var password = _configuration["Email:Password"];
            var from = _configuration["Email:From"];

            if (string.IsNullOrWhiteSpace(host) ||
                !int.TryParse(portText, out var port) ||
                string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password) ||
                string.IsNullOrWhiteSpace(from))
            {
                throw new InvalidOperationException(
                    "Email SMTP settings are not configured. Configure Email:SmtpHost, Email:SmtpPort, Email:Username, Email:Password and Email:From.");
            }

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(username, password),
                DeliveryMethod = SmtpDeliveryMethod.Network
            };

            using var message = new MailMessage(from, recipient, subject, htmlBody)
            {
                IsBodyHtml = true
            };

            await client.SendMailAsync(message, ct);
            _logger.LogInformation("Password reset email sent.");
        }
    }
}
