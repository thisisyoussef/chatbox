# SC-007B Design Research

## Sources

- [Google Identity Services: Authorizing for Web](https://developers.google.com/identity/oauth2/web/guides/overview)
- [Google OAuth 2.0 Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

## Findings

- GIS web access tokens are short-lived and should be re-requested explicitly
  when API calls fail due to auth expiry.
- OAuth best practices recommend contextual scope requests, explicit handling
  for denial, and secure token treatment instead of long-lived client-side
  storage.

## Product Implications

- Expired auth should be presented as a reconnect action, not as a fatal app
  error.
- Denied consent should not erase local flashcard work because the currently
  open deck is not the Drive source of truth.
- Production proof should include degraded fixtures, not only happy-path
  fixtures, so reviewers can audit host-owned recovery behavior directly.
