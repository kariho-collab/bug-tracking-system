# Premium UI upgrade - notes

Visual layer only. Routes, forms, field names, sessions, authentication, authorization and
database operations are unchanged. Two small data/redirect additions are listed below.

## Files changed
- public/style.css            rewritten: design tokens, ambient background, cards, buttons, tables, charts, toasts, modal
- public/app.js               NEW: count-up, toasts, sidebar, account menu, modal, tooltips, loading states
- public/fonts/*.woff2        NEW: Sora (500/600/700) and Instrument Sans (400/500/600), self-hosted
- views/partials/head.ejs, shell-start.ejs, shell-end.ejs, foot.ejs   NEW shared layout
- views/partials/navbar.ejs   REMOVED (replaced by the sidebar in shell-start.ejs)
- views/login.ejs, register.ejs, dashboard.ejs, report-bug.ejs, bugs.ejs, bug-detail.ejs, reports.ejs, users.ejs   restyled
- routes/pages.js             dashboard now passes `total`; redirects carry a fixed ?toast=<key> so a confirmation toast can show
- server.js                   auto-seed block (same as the one you already added for Render)
- package.json                now lists dependencies (the earlier zip omitted them) - keep YOUR package.json if it already works

## Behaviour notes
- Toast keys are a fixed whitelist in app.js; arbitrary text from the URL is never displayed.
- Native <select> menus are kept native (accessible, reliable on phones). Their open list is drawn by the OS and cannot be animated.
- Layout-affecting transitions (sidebar width, expandable panels) run only on a user toggle; everything else uses transform/opacity.
- prefers-reduced-motion switches off ambient drift, entrance, count-up, chart growth and view transitions.
