**AI Command + ChatGPT Automation Plan (Updated)**

---

### 1. Feature Goals
1. `/ai` stays in the sidepanel and uses the user’s own ChatGPT session (no API key required).
2. Responses stream back into our chat log; users can perform actions like “Save to notes”.
3. If ChatGPT’s DOM changes, users can override selectors in a settings flow.
4. Messaging between sidepanel ↔ background ↔ content scripts is centralized via shared helpers.
5. Chat UI is modular so we can add per-message actions and richer rendering later.

---

### 2. Chat UI Refactor

**Component split**

| Component | Responsibility |
|-----------|----------------|
| `ChatView.vue` | Owns conversation array, orchestrates fetch states, hooks into background messaging. |
| `ChatMessage.vue` | Renders a single message (user or assistant), markdown/mermaid rendering, error states. |
| `ChatActions.vue` | Buttons per message (`Save`, `Copy`, etc.). |
| `ChatInput.vue` | Textarea, suggestions, submit events. |

**Adjustments**
- `ChatBox.vue` becomes a thin shell that composes these pieces; existing logic is migrated into the new components.
- Message objects include metadata (`role`, `status`, `id`, maybe `context`).
- Provide slots/hooks for message-level actions (e.g., “Save to notes”, “Copy raw text”).

---

### 3. Messaging Utilities

**New helper** (e.g. `src/shared/messaging/client.ts`):
```ts
export async function sendRequest<T>(type: string, data?: any): Promise<T>;
export function addBackgroundListener(type: string, handler: (payload) => void): () => void;
```

- Wrapping `chrome.runtime.sendMessage` means every feature (Chat, versions, etc.) uses consistent error handling, timeouts, and payload typing.
- We can extend it later if we introduce streaming channels.

---

### 4. ChatGPT Automation Flow (Option 1)

#### Step-by-step

1. **Sidepanel** (`ChatView`):
   - On `/ai`, push a “user” message and call `sendRequest('AI_RUN_PROMPT', { prompt })`.
   - While waiting, show a synthetic “assistant” message in `status: "loading"` state.
   - Listen for `AI_PROGRESS` and `AI_RESULT` via `addBackgroundListener` to update the message body incrementally.
   - If `AI_ERROR` with `reason: 'missing_selector'`, open an override modal.

2. **Background service worker**:
   - `AI_RUN_PROMPT` handler:
     1. Find or open a `chatgpt.com` tab (respect “reuse tab” option).
     2. Inject the ChatGPT content script (if not already).
     3. Send `{ type: 'AI_EXECUTE_PROMPT', prompt, selectors }` to that tab.
   - Bridges responses from the content script back to the sidepanel using the helper.

3. **ChatGPT content script** (`chatgpt-bridge.ts`):
   - Listen for `AI_EXECUTE_PROMPT`.
   - Resolve selectors (default + overrides).
   - Locate input/submit elements:
     - If found, insert prompt, click send.
     - Observe conversation container via `MutationObserver` and dispatch `AI_PROGRESS` events.
     - On completion, send `AI_RESULT`.
   - If elements missing, send `AI_ERROR` (`reason: 'missing_selector'`).

4. **Selector overrides**:
   - Stored in `chrome.storage.local` under keys like `{ aiSelectors: { input, send, response } }`.
   - Options page exposes a UI to edit/reset them.
   - Sidepanel uses a small modal to collect overrides when detection fails.

---

### 5. Options / Settings Updates

Add an “AI Automation” section to `options/index.html`:

- Toggle: “Enable ChatGPT automation”.
- Advanced: edit CSS selectors for prompt, send button, response container.
- Reset button returns to defaults.
- Possibly show detection logs to help the user.

---

### 6. Content Security & CSP Compliance

- Remove inline `onclick` usage (already done in Mermaid preview).
- Content script only injects automation logic; no DOM modifications beyond necessary input/observer.

---

### 7. UX Safeguards

- Before sending, verify the user is still logged into ChatGPT (detect login prompts; if found, send `AI_ERROR: 'auth_required'` and open the tab for them).
- Provide status updates in the chat message: “Opening ChatGPT…”, “Waiting for response…”.
- If automation fails entirely, provide a fallback link “Open ChatGPT manually” with the prompt prefilled via query (if possible).

---

### 8. Implementation Sequence

1. **Messaging helper** – create the shared `sendRequest` / listener utilities.
2. **Chat component refactor** – move logic into new `ChatView`, `ChatMessage`, `ChatActions`, `ChatInput`.
3. **Background bridging** – implement `AI_RUN_PROMPT` handler, tab management, and safe content-script injection.
4. **Content script** – implement DOM automation, selectors, `MutationObserver` streaming.
5. **Selector overrides** – storage API + sidepanel modal + options UI.
6. **Fallback & error states** – handle `missing_selector`, `auth_required`, timeouts gracefully.
7. **QA** – test with default DOM, with overrides, with chatgpt.com logged-out state.

---

### 9. Future Enhancements

- Streaming tokens word-by-word (current plan returns incremental `AI_PROGRESS`).
- Support other providers (Claude, Perplexity) via equivalent automation or API keys.
- Save assistant responses automatically as notes, surface history snapshots, etc.


---

### Considerations & Recommendations

#### 1. Implementation Priority Suggestions
- **HIGH** – Messaging utilities (foundation; unblock other features)
- **HIGH** – Core ChatGPT automation (option 1 DOM integration)
- **MED** – Chat UI refactor (can roll out component-by-component)
- **LOW** – Advanced selector override UX (basic modal first, richer tooling later)

#### 2. Risk Mitigation
- *Rate limiting*: throttle requests & display user-friendly “try again” messaging on 429s.
- *Tab collision*: track which ChatGPT tab we injected; prevent two `/ai` runs from fighting over the same tab; consider queueing.
- *Version compatibility*: monitor DOM selectors via logged telemetry; maintain fallback flows and override UI.

#### 3. Enhanced Error Handling
Expand the error enum so the sidepanel can provide actionable feedback:

```ts
type AIError =
  | 'missing_selector'
  | 'auth_required'
  | 'rate_limited'
  | 'network_error'
  | 'chatgpt_error'
  | 'content_policy_violation'
  | 'unknown';
```

  ---
  🔧 Current Codebase Alignment

  Already Compatible:

  - ✅ Current messaging patterns support this architecture
  - ✅ Sidepanel store structure ready for chat state
  - ✅ Options page can easily accommodate AI settings
  - ✅ Content script infrastructure exists

  Needs Implementation:

  - 🔨 Shared messaging utilities (src/shared/messaging/client.ts)
  - 🔨 ChatGPT content script (chatgpt-bridge.ts)
  - 🔨 Background AI request handlers
  - 🔨 Chat component refactor

  ---
  💡 Implementation Suggestions

  Phase 1: Foundation (Week 1)

  // 1. Create messaging utilities
  export async function sendRequest<T>(type: string, data?: any): Promise<T>
  export function addBackgroundListener(type: string, handler: Function)

  // 2. Basic background handler
  case 'AI_RUN_PROMPT':
    await openChatGPTTab()
    await injectContentScript()
    // Bridge to content script

  Phase 2: Core Automation (Week 2)

  // 3. ChatGPT content script
  const executePrompt = (prompt: string, selectors: AISelectors) => {
    const input = document.querySelector(selectors.input)
    const submit = document.querySelector(selectors.submit)
    // ... automation logic
  }

  Phase 3: Enhancement (Week 3)

  - Chat UI refactor
  - Selector overrides
  - Advanced error handling

  ---
  🚀 Recommendation: PROCEED

  This plan is ready for implementation. The architecture is sound, the user experience
   is well-considered, and it integrates naturally with the existing codebase.

  Suggested next steps:
  1. Start with messaging utilities (foundational)
  2. Implement basic ChatGPT automation (MVP)
  3. Add error handling and fallbacks
  4. Refactor chat UI incrementally

