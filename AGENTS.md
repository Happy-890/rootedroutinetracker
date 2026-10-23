<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep RootedProvider and the single toast host in the root shell so all content routes share account state.
- Keep scoring and local calendar arithmetic in the pure Rooted logic module so rules are independently testable.
- Use the managed Lovable OAuth helper for social sign-in so preview and published login share the supported flow.
- Entry inserts award their activity via a database trigger in one transaction; do not reintroduce a second award write.
- Offline shell uses generated Workbox with a guarded single registrar; never cache auth, API or private account responses.
- Scoring writes use an authoritative database Central-time clock and pure matching guest guard; historical imported writing is explicitly non-awarding so imports cannot reopen closed days.
- Appearance is device-local in a shared root provider; theme colors live in semantic CSS tokens so every screen follows the selected mode.
- Web Push uses a separate messaging-only worker scoped to /notifications/ and Web Crypto delivery; owner-scoped preferences and device subscriptions survive delivery-provider changes.
- VAPID keys are generated once with Web Crypto and stored encrypted in a server-only table; the application secret protects private key material without exposing it to clients.
- Scheduled reminders use managed authenticated HTTP callbacks and atomic per-device daily claims; external push endpoints are allowlisted to prevent server-side request forgery.
