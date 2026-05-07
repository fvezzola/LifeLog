// Where the LifeLog backend lives. Empty string = same-origin (the page
// is served by the same Hono server that handles the API). All API
// requests become relative URLs like `/api/me`.
//
// Set this to a full URL only if you host the PWA somewhere different
// from the backend (e.g. PWA on GitHub Pages, API on a tailnet host).
// In that case the backend must also have ALLOWED_ORIGIN set to this
// page's origin so CORS works.
//
// Default: same-origin (recommended).
export const API_BASE = '';
