# Security Policy

Collectrr takes the security of our platform, user communications, and financial workflows seriously.

## Supported Versions

Only the current V2 edge architecture is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x: (Deprecated)   |

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data exposure within Collectrr, please **do not open a public GitHub issue**.

Instead, please send an email to:
**security@collectrr.dev** (or contact the repository maintainers directly)

Please include:
1. Description of the vulnerability or risk.
2. Steps to reproduce or proof-of-concept payload.
3. Impact assessment (e.g., unauthorized document access, token exposure, tenant bypass).

We commit to acknowledging your report within 48 hours and providing a remediation timeline within 7 business days.

## Zero Secrets Policy & Secrets Handling

Collectrr adheres to a strict **Zero Secrets in Source Control** policy.
- **Production Secrets**: Stored exclusively via Cloudflare Secrets (`wrangler secret put <KEY>`).
- **Local Secrets**: Stored exclusively in local `v2/.dev.vars`, which is permanently listed in `.gitignore`.
- **CI / Pipeline**: Automated security scans run on every pull request to reject commits containing tokens, private keys, or credentials.

### Credential Rotation Procedures

If any secret or token is suspected to have been exposed:
1. **Meta / WhatsApp Cloud API Token**:
   - Immediately revoke the System User Access Token in Meta Business Manager.
   - Generate a new System User Token with appropriate permissions (`whatsapp_business_messaging`, `whatsapp_business_management`).
   - Update the secret in Cloudflare: `wrangler secret put WHATSAPP_ACCESS_TOKEN`.
2. **Gemini API Key**:
   - In Google Cloud Console or Google AI Studio, delete the compromised API key.
   - Generate a new key and update: `wrangler secret put GEMINI_API_KEY`.
3. **Webhook Verify Token**:
   - Update Meta Developer Portal Webhook configuration with a newly generated high-entropy string.
   - Update: `wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
