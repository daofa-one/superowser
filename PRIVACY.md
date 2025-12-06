# Privacy Policy for Superowser

**Last Updated:** December 2, 2025

## Overview

Superowser is a browser extension that helps you save, organize, and quickly retrieve web pages. Your privacy is important to us. This privacy policy explains what data we collect, how we use it, and your rights regarding your data.

## Information We Collect

Superowser collects and stores the following information **locally on your device only**:

### 1. Saved Pages
- **Page URL**: The web address of pages you save
- **Page Title**: The title of saved pages
- **Favicon**: The site icon of saved pages
- **Tags**: Tags you assign to organize pages
- **Shortcuts**: Custom shortcuts (e.g., @github) you create for quick access
- **Tasks/Collections**: Task names and page groupings you create
- **Timestamps**: When pages were saved and last accessed

### 2. Notes and Highlights
- **Note Content**: Text content of notes you create
- **Note Comments**: Additional comments you add to notes
- **Associated Tags**: Tags you assign to notes
- **Timestamps**: When notes were created and modified

### 3. Usage Analytics (Local Only)
- **Access Patterns**: Which pages you access most frequently
- **Search Queries**: Searches you perform within the extension
- **Feature Usage**: Which features you use (omnibox, chat, tasks, etc.)
- **Interaction Data**: Click patterns and navigation behavior

**Important:** All analytics data is stored **locally on your device only** and is used solely to improve your personal experience (e.g., suggesting frequently accessed pages).

## How We Use Information

All data collected by Superowser is used exclusively to:

1. **Save and organize your pages**: Store your saved pages, notes, and organizational structure
2. **Enable search and retrieval**: Allow you to quickly find and access saved content
3. **Improve your experience**: Learn your usage patterns to provide better suggestions and rankings
4. **Maintain functionality**: Support features like shortcuts, tags, and tasks

## Data Storage

**All data is stored locally on your device only.** Superowser uses:

- **IndexedDB**: Browser database for storing pages, notes, and tasks
- **Chrome Storage API**: Chrome's local storage for extension settings and data

**We do not:**
- Transmit your data to external servers
- Store your data in the cloud
- Share your data with third parties
- Use your data for advertising or marketing

## Data Retention

- **Default Retention**: Data is retained indefinitely until you explicitly delete it
- **Automatic Cleanup**: Optional feature to automatically delete pages not accessed in 90 days
- **Manual Control**: You can delete individual items or clear all data at any time

## Your Rights and Controls

You have complete control over your data:

### 1. Access Your Data
All your data is accessible through the extension's side panel interface.

### 2. Export Your Data
You can export all your data to JSON format through the extension settings (feature in development).

### 3. Delete Your Data
- **Individual Deletion**: Remove specific pages, notes, or tasks through the UI
- **Bulk Deletion**: Clear all data by removing the extension
- **Browser Tools**: Access `chrome://settings/siteData` and clear data for this extension

### 4. No Account Required
Superowser does not require an account, login, or any personal information.

## Third-Party Services

Superowser does not integrate with or send data to any third-party services, with the following exceptions:

### Optional AI Automation Features
If you explicitly enable AI automation features, the extension may:
- Inject scripts into specific websites you authorize (e.g., ChatGPT, Claude)
- Interact with those websites on your behalf
- **No data is sent to Superowser servers**; interactions occur directly between your browser and the authorized websites

### Favicon Retrieval
The extension may fetch favicons (site icons) directly from websites to display alongside saved pages. This is a standard browser feature.

## Data Security

### Local-Only Storage
Since all data is stored locally on your device, your data security depends on:
- Your device's security (password protection, encryption)
- Your Chrome profile security (Chrome sync password if enabled)
- Chrome's built-in security features

### No Remote Transmission
Superowser does not transmit any of your data over the internet to external servers.

## Children's Privacy

Superowser does not knowingly collect information from children under 13 years of age. The extension is designed for general audiences and does not target children.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Changes will be reflected in:
- The "Last Updated" date at the top of this document
- Release notes in the Chrome Web Store listing
- The extension's changelog

Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact Information

If you have questions or concerns about this privacy policy or your data:

- **GitHub Issues**: [Create an issue on our repository]
- **Email**: [Your support email]

## Permissions Explained

Superowser requests the following Chrome permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Store your pages, notes, and settings locally |
| `unlimitedStorage` | Support large collections of saved pages |
| `tabs` | Access current tab information when saving pages |
| `activeTab` | Get the title and URL of the active tab |
| `contextMenus` | (Future) Right-click menu for saving highlights |
| `sidePanel` | Display the extension's side panel interface |
| `omnibox` | Enable `` ` `` search in Chrome's address bar |
| `scripting` | (Optional) AI automation features on authorized sites |
| `favicon` | Display website icons alongside saved pages |

## Open Source

Superowser is open source. You can review the complete source code to verify our privacy practices:

- **Repository**: [https://github.com/daofa-one/superowser/]
- **License**: [MIT]

## Compliance

### GDPR (European Users)
If you are in the European Economic Area (EEA):
- **Right to Access**: You can view all your data through the extension interface
- **Right to Deletion**: You can delete your data at any time
- **Right to Portability**: Export functionality allows you to download your data
- **Right to Rectification**: You can edit or update any saved data
- **Data Controller**: You are the controller of your own data; we do not access it

### CCPA (California Users)
If you are a California resident:
- **No Sale of Data**: We do not sell your personal information
- **No Sharing**: We do not share your personal information with third parties
- **Local Storage Only**: All data remains on your device

## Summary

**In short:**
- ✅ All data stored locally on your device only
- ✅ No cloud storage or external servers
- ✅ No data transmission over the internet
- ✅ No tracking or analytics sent externally
- ✅ You control all your data
- ✅ You can delete everything at any time
- ✅ No account or personal information required

---

**Your privacy is paramount. Superowser is designed as a local-first, privacy-respecting tool that gives you complete control over your data.**
