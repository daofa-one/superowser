---
description: Build extension for production
---

Build the extension for production:

```bash
pnpm build
```

This will:
- Build with production optimizations
- Minify code
- Remove source maps
- Output to `dist/` directory

To test the production build:
1. Navigate to `chrome://extensions/`
2. Load the `dist/` directory as an unpacked extension

To package for distribution:
```bash
cd dist
zip -r ../superowser-extension.zip .
```

Upload the `.zip` file to Chrome Web Store dashboard.
