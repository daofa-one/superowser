---
description: Run tests and type checking for the extension
---

Run comprehensive tests for the Superowser extension.

This command will execute:
1. **TypeScript type checking** - Validates type safety across all files
2. **ESLint code quality checks** - Ensures code follows style guidelines
3. **Build verification** - Confirms the extension builds successfully

Simply run:
```bash
pnpm test
```

Or run individual checks:
```bash
pnpm typecheck    # Type checking only
pnpm lint         # Linting only
pnpm build        # Build only
```

**What gets validated:**
- ✅ Type safety across all TypeScript files
- ✅ Code quality and style guidelines (ESLint)
- ✅ Successful production build
- ✅ No compilation errors

**Manual Testing Checklist**

After automated tests pass, perform manual testing:
- [ ] Extension loads in Chrome (`chrome://extensions`)
- [ ] Omnibox search works (`` ` @shortcut``, `` ` #tag``, `` ` &task``)
- [ ] Save page functionality
- [ ] Chat commands execute properly
- [ ] AI automation (if enabled)
- [ ] Settings update correctly

See detailed checklist in: `src/background/CODE_REVIEW_FIXES.md`
