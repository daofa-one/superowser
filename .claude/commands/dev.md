---
description: Start development server and watch for changes
---

Start the development build with hot reload:

```bash
pnpm dev
```

This will:
- Build the extension in development mode
- Watch for file changes
- Generate source maps for debugging
- Output to `dist/` directory

After running, load the unpacked extension in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

To rebuild and test changes:
- Most changes hot-reload automatically
- For background script changes, click the extension reload button
- For manifest changes, reload the extension manually
