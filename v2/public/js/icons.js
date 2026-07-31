/**
 * Collectrr Icon Library Registry
 * 
 * Each icon entry contains:
 * - id: Unique string ID matching the folder name in /public/assets/icons/{id}/
 * - description: Detailed description of the icon purpose and placement in the app
 * - assetPath: Relative URL path to the custom media file (e.g. /assets/icons/{id}/icon.svg or icon.png)
 * - placeholderSvg: Inline fallback SVG markup used when media file is not present
 */

const IconLibrary = {
  "icon_dashboard": {
    id: "icon_dashboard",
    description: "Sidebar navigation icon for the main Loan Cases Dashboard tab.",
    assetPath: "/assets/icons/icon_dashboard/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`
  },
  "icon_analytics": {
    id: "icon_analytics",
    description: "Sidebar navigation icon for the Analytics performance metrics tab.",
    assetPath: "/assets/icons/icon_analytics/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>`
  },
  "icon_docs_pending": {
    id: "icon_docs_pending",
    description: "Dashboard summary stat card icon for 'Docs Pending' status.",
    assetPath: "/assets/icons/icon_docs_pending/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
  },
  "icon_ready_review": {
    id: "icon_ready_review",
    description: "Dashboard summary stat card icon for 'Ready for Review' status.",
    assetPath: "/assets/icons/icon_ready_review/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
  },
  "icon_submitted": {
    id: "icon_submitted",
    description: "Dashboard summary stat card icon for 'Submitted' status.",
    assetPath: "/assets/icons/icon_submitted/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
  },
  "icon_upload": {
    id: "icon_upload",
    description: "Public client upload portal file dropzone and upload button icon.",
    assetPath: "/assets/icons/icon_upload/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`
  },
  "icon_doc_generic": {
    id: "icon_doc_generic",
    description: "Generic document requirement icon in checklist lists.",
    assetPath: "/assets/icons/icon_doc_generic/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
  },
  "icon_doc_pan": {
    id: "icon_doc_pan",
    description: "PAN Card document requirement badge icon.",
    assetPath: "/assets/icons/icon_doc_pan/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="6" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M15 11h2"/><path d="M15 13h2"/></svg>`
  },
  "icon_doc_aadhaar": {
    id: "icon_doc_aadhaar",
    description: "Aadhaar Card document requirement badge icon.",
    assetPath: "/assets/icons/icon_doc_aadhaar/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1 0 7.75"/></svg>`
  },
  "icon_doc_bank": {
    id: "icon_doc_bank",
    description: "Bank Statement document requirement badge icon.",
    assetPath: "/assets/icons/icon_doc_bank/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7 12 2"/></svg>`
  },
  "icon_doc_gst": {
    id: "icon_doc_gst",
    description: "GST Returns document requirement badge icon.",
    assetPath: "/assets/icons/icon_doc_gst/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>`
  },
  "icon_whatsapp": {
    id: "icon_whatsapp",
    description: "WhatsApp brand integration action icon.",
    assetPath: "/assets/icons/icon_whatsapp/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
  },
  "icon_copy": {
    id: "icon_copy",
    description: "Copy link to clipboard action button icon.",
    assetPath: "/assets/icons/icon_copy/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
  },
  "icon_edit": {
    id: "icon_edit",
    description: "Edit case details modal trigger button icon.",
    assetPath: "/assets/icons/icon_edit/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`
  },
  "icon_view": {
    id: "icon_view",
    description: "View submitted document file action button icon.",
    assetPath: "/assets/icons/icon_view/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
  },
  "icon_user": {
    id: "icon_user",
    description: "User profile avatar and agent role indicator icon.",
    assetPath: "/assets/icons/icon_user/icon.svg",
    placeholderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  }
};

/**
 * Renders the HTML markup for an icon by its ID.
 * Returns custom media tag <img src="..."> if media file exists, or placeholder SVG.
 */
function getIconHtml(iconId, customClass = "") {
  const item = IconLibrary[iconId];
  if (!item) return "";
  return `<span class="app-icon ${customClass}" data-icon-id="${item.id}" title="${item.description}">${item.placeholderSvg}</span>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { IconLibrary, getIconHtml };
}
