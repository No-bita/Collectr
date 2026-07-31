# Collectrr App Icon Library

This directory houses the structured Icon Library for the Collectrr application. Every icon is registered with a **unique ID**, a **description** of its placement in the app, an **asset folder**, and an **inline fallback SVG**.

---

## 📁 Icon Folder & File Directory Map

Each media asset is stored in a dedicated folder named by its **ID**:

| Icon ID | Description / Location in App | Media Folder Path |
| :--- | :--- | :--- |
| `icon_dashboard` | Sidebar navigation icon for Dashboard | `v2/public/assets/icons/icon_dashboard/` |
| `icon_analytics` | Sidebar navigation icon for Analytics | `v2/public/assets/icons/icon_analytics/` |
| `icon_docs_pending` | Summary card icon for 'Docs Pending' status | `v2/public/assets/icons/icon_docs_pending/` |
| `icon_ready_review` | Summary card icon for 'Ready for Review' status | `v2/public/assets/icons/icon_ready_review/` |
| `icon_submitted` | Summary card icon for 'Submitted' status | `v2/public/assets/icons/icon_submitted/` |
| `icon_upload` | Public portal drag-and-drop file upload action | `v2/public/assets/icons/icon_upload/` |
| `icon_doc_generic` | Generic document requirement checklist badge | `v2/public/assets/icons/icon_doc_generic/` |
| `icon_doc_pan` | PAN Card document badge icon | `v2/public/assets/icons/icon_doc_pan/` |
| `icon_doc_aadhaar` | Aadhaar Card document badge icon | `v2/public/assets/icons/icon_doc_aadhaar/` |
| `icon_doc_bank` | Bank Statement document badge icon | `v2/public/assets/icons/icon_doc_bank/` |
| `icon_doc_gst` | GST Returns document badge icon | `v2/public/assets/icons/icon_doc_gst/` |
| `icon_whatsapp` | WhatsApp integration action icon | `v2/public/assets/icons/icon_whatsapp/` |
| `icon_copy` | Copy link to clipboard button icon | `v2/public/assets/icons/icon_copy/` |
| `icon_edit` | Edit case details modal button icon | `v2/public/assets/icons/icon_edit/` |
| `icon_view` | View submitted document file button icon | `v2/public/assets/icons/icon_view/` |
| `icon_user` | User avatar and agent role icon | `v2/public/assets/icons/icon_user/` |

---

## 🛠️ How to Update Icons & Descriptions

1. **Adding Custom Media Files**:
   Drop your custom image file (`icon.svg`, `icon.png`, or `icon.webp`) into the folder matching the ID.
   Example: To update `icon_dashboard`, add your file to `v2/public/assets/icons/icon_dashboard/icon.svg`.

2. **Updating Registry & Descriptions**:
   Edit [`v2/public/js/icons.js`](file:///Users/aaryanshah/Downloads/Lekho-Edge/v2/public/js/icons.js) or [`v2/public/assets/icons/icons-manifest.json`](file:///Users/aaryanshah/Downloads/Lekho-Edge/v2/public/assets/icons/icons-manifest.json) to update the `description`, `placeholderSvg`, or `assetPath`.
