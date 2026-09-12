# Native App Router — route parity map

| Product path | Former SPA bridge | Native App Router | Client needs |
|---|---|---|---|
| `/` | `App.jsx` Route → DashboardPage | `app/(workspace)/page.tsx` | Shell + dashboard interactions |
| `/calendar` | CalendarPage (lazy) | `app/(workspace)/calendar/page.tsx` | DnD calendar, URL `?view=` |
| `/content` | ContentPage | `app/(workspace)/content/page.tsx` | Filters, URL `?status=` |
| `/content/new` | ComposerPage | `app/(workspace)/content/new/page.tsx` | Composer form |
| `/content/[contentId]` | ComposerPage | `app/(workspace)/content/[contentId]/page.tsx` | Composer edit |
| `/campaigns` | CampaignsPage | `app/(workspace)/campaigns/page.tsx` | Lists / tabs |
| `/campaigns/[campaignId]` | CampaignWorkspace | `app/(workspace)/campaigns/[campaignId]/page.tsx` | Tabs via `?tab=` |
| `/inbox` | InboxPage | `app/(workspace)/inbox/page.tsx` | Interactive inbox |
| `/analytics` | AnalyticsPage | `app/(workspace)/analytics/page.tsx` | Charts / filters |
| `/accounts` | AccountsPage | `app/(workspace)/accounts/page.tsx` | Account forms |
| `/settings` | SettingsPage | `app/(workspace)/settings/page.tsx` | Settings forms |
| `/queue` | QueuePage | `app/(workspace)/queue/page.tsx` | Queue list |
| Legacy `/dashboard`, `/login`, … | `<Navigate>` | `next.config.ts` redirects | — |
| Unknown | NotFound route | `app/not-found.tsx` | Soft 404 UI |

**Shell:** `WorkspaceProviders` + `AppShellNext` in `app/(workspace)/layout.tsx` (persists across navigations).

**Removed:** `ClientSpa`, `SpaBridge`, `app/[...slug]`, product `BrowserRouter`.

**Vitest:** still uses `MemoryRouter` + `App.jsx` routes with `@/nav` → `nav/vite.jsx`.
