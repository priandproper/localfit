// Backend base URL. Empty string = same-origin relative (local dev/build served
// by Express). The hosted Pages build injects the Mac mini's HTTPS address via
// VITE_API_BASE at build time.
export const API_BASE = import.meta.env.VITE_API_BASE || ''
