# Premium UI upgrade - notes (light theme)

Visual layer only. Routes, forms, field names, sessions, authentication, authorization and
database operations are unchanged. Two small data/redirect additions are listed below.

## Files changed
- public/style.css            rewritten as a LIGHT theme: white cards on a soft off-white page, violet/cyan accents; the sidebar keeps its own navy palette (--sb-* variables)
- public/style.dark.css       the previous dark theme, kept as an optional alternative (see 'Switching themes')
- public/app.js               NEW: count-up, toasts, sidebar, account menu, modal, tooltips, loading states
- public/fonts/*.woff2        NEW: Sora (500/600/700) and Instrument Sans (400/500/600), self-hosted
- views/partials/head.ejs, shell-start.ejs, shell-end.ejs, foot.ejs   NEW shared layout
- views/partials/navbar.ejs   REMOVED (replaced by the sidebar in shell-start.ejs)
- views/partials/head.ejs     meta color-scheme/theme-color set for the light page
- views/reports.ejs           status-segment colours darkened so they read against white
- views/login.ejs, register.ejs, dashboard.ejs, report-bug.ejs, bugs.ejs, bug-detail.ejs, reports.ejs, users.ejs   restyled
- routes/pages.js             dashboard now passes `total`; redirects carry a fixed ?toast=<key> so a confirmation toast can show
- server.js                   auto-seed block (same as the one you already added for Render)
- package.json                now lists dependencies (the earlier zip omitted them) - keep YOUR package.json if it already works

## Behaviour notes
- Toast keys are a fixed whitelist in app.js; arbitrary text from the URL is never displayed.
- Native <select> menus are kept native (accessible, reliable on phones). Their open list is drawn by the OS and cannot be animated.
- Layout-affecting transitions (sidebar width, expandable panels) run only on a user toggle; everything else uses transform/opacity.
- prefers-reduced-motion switches off ambient drift, entrance, count-up, chart growth and view transitions.

## Switching themes
All colours live in the :root block at the top of the stylesheet. To go back to dark, in views/partials/head.ejs change
`/style.css?v=2` to `/style.dark.css?v=2`, `color-scheme` content to "dark" and theme-color to "#0a1020".
To make the sidebar light too, change the --sb-* variables in :root.

## Light-theme checks run
- 85 contrast pairs measured (text, badges, buttons, sidebar, alerts, chart graphics, input borders): 0 failures
- 53 end-to-end browser checks: all pass
