<template>
  <div class="help-view">
    <!-- Header -->
    <div class="help-header">
      <h2 class="help-title">📚 Help & Documentation</h2>
      <p class="help-subtitle">Learn how to get the most out of Superowser</p>
    </div>

    <!-- Accordion Sections -->
    <div class="help-content">
      <!-- Section 1: Getting Started -->
      <section class="help-section">
        <button @click="toggleSection('getting-started')" class="section-header">
          <span class="section-icon">{{ expandedSections.has('getting-started') ? '▼' : '▶' }}</span>
          <span class="section-title">🚀 Getting Started</span>
        </button>
        <div v-if="expandedSections.has('getting-started')" class="section-content">
          <p>
            Superowser helps you save, organize, and quickly retrieve web pages. Instead of keeping dozens of tabs open,
            save pages with meaningful tags, shortcuts, and tasks for instant access later.
          </p>
          <p>
            This guide covers the <strong>omnibox</strong> (Chrome address bar search) and <strong>chat commands</strong>
            to help you master Superowser quickly.
          </p>
        </div>
      </section>

      <!-- Section 2: Omnibox Trigger (CRITICAL) -->
      <section class="help-section">
        <button @click="toggleSection('omnibox-trigger')" class="section-header">
          <span class="section-icon">{{ expandedSections.has('omnibox-trigger') ? '▼' : '▶' }}</span>
          <span class="section-title">⌨️ How to Use Omnibox</span>
        </button>
        <div v-if="expandedSections.has('omnibox-trigger')" class="section-content">
          <div class="callout callout-primary">
            <h3>🎯 Activating Superowser</h3>
            <ol class="activation-steps">
              <li>Click Chrome's address bar (or press <kbd>Cmd+L</kbd> / <kbd>Ctrl+L</kbd>)</li>
              <li>Type a <strong>backtick</strong>: <code class="key">`</code></li>
              <li>Press <kbd>Space</kbd> or <kbd>Tab</kbd></li>
              <li>Start typing your search</li>
            </ol>
          </div>

          <div class="address-bar-visual">
            <pre>
┌─────────────────────────────────────────┐
│  ` your search query           🔍       │  ← Chrome address bar
└─────────────────────────────────────────┘
   ↑
   Type backtick (`) here
            </pre>
          </div>

          <div class="callout callout-info">
            <strong>💡 Finding the backtick key:</strong>
            <ul>
              <li>US keyboards: Top-left, below <kbd>Esc</kbd>, left of <kbd>1</kbd></li>
              <li>Usually shares the key with <code>~</code> (tilde)</li>
              <li>On some keyboards it may be next to <kbd>Enter</kbd> or near <kbd>Backspace</kbd></li>
            </ul>
          </div>

          <p class="tip-text">
            Once activated, you'll see "Superowser" appear in the address bar, and you can start searching
            your saved pages using the patterns described below.
          </p>
        </div>
      </section>

      <!-- Section 3: Omnibox Search Patterns -->
      <section class="help-section">
        <button @click="toggleSection('patterns')" class="section-header">
          <span class="section-icon">{{ expandedSections.has('patterns') ? '▼' : '▶' }}</span>
          <span class="section-title">🔍 Omnibox Search Patterns</span>
        </button>
        <div v-if="expandedSections.has('patterns')" class="section-content">
          <p>Superowser supports 6 powerful search patterns:</p>

          <table class="patterns-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Purpose</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>` @shortcut</code></td>
                <td>Open saved page instantly</td>
                <td><code>` @gmail</code></td>
              </tr>
              <tr>
                <td><code>` #tag</code></td>
                <td>Filter pages by tag</td>
                <td><code>` #research</code></td>
              </tr>
              <tr>
                <td><code>` &task</code></td>
                <td>Show task pages</td>
                <td><code>` &work</code></td>
              </tr>
              <tr>
                <td><code>` !!query</code></td>
                <td>Search notes/highlights</td>
                <td><code>` !!TODO</code></td>
              </tr>
              <tr>
                <td><code>` /command</code></td>
                <td>Execute commands</td>
                <td><code>` /save</code></td>
              </tr>
              <tr>
                <td><code>` query</code></td>
                <td>Fuzzy search (typo-tolerant)</td>
                <td><code>` machine learning</code></td>
              </tr>
            </tbody>
          </table>

          <div class="pattern-details">
            <h4>Pattern Details</h4>

            <!-- @shortcut pattern -->
            <div class="pattern-card">
              <h5><code>@</code> Shortcut Pattern</h5>
              <p><strong>What it does:</strong> Instantly opens a saved page by its shortcut.</p>
              <p><strong>When to use:</strong> For frequently accessed pages you've assigned shortcuts to.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` @gh</code> - Open GitHub if you saved it with shortcut "gh"</li>
                <li><code>` @docs</code> - Open documentation page</li>
                <li><code>` @calendar</code> - Open your calendar</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Set shortcuts when saving pages for one-keystroke access!</p>
            </div>

            <!-- #tag pattern -->
            <div class="pattern-card">
              <h5><code>#</code> Tag Pattern</h5>
              <p><strong>What it does:</strong> Filters and shows all pages with a specific tag.</p>
              <p><strong>When to use:</strong> To find pages in a category or topic.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` #javascript</code> - Show all JavaScript-related pages</li>
                <li><code>` #research</code> - Show research pages</li>
                <li><code>` #work</code> - Show work-related pages</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Use multiple tags per page for flexible organization!</p>
            </div>

            <!-- &task pattern -->
            <div class="pattern-card">
              <h5><code>&</code> Task Pattern</h5>
              <p><strong>What it does:</strong> Activates a task and shows all related pages.</p>
              <p><strong>When to use:</strong> When working on a specific project or collection of pages.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` &project-alpha</code> - Show Project Alpha pages</li>
                <li><code>` &learning-vue</code> - Show Vue.js learning resources</li>
                <li><code>` &client-work</code> - Show client project pages</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Tasks keep related pages together like folders!</p>
            </div>

            <!-- !!notes pattern -->
            <div class="pattern-card">
              <h5><code>!!</code> Notes Pattern</h5>
              <p><strong>What it does:</strong> Searches through your saved notes and highlights.</p>
              <p><strong>When to use:</strong> To find specific text you've highlighted or noted.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` !!TODO</code> - Find notes containing "TODO"</li>
                <li><code>` !!meeting</code> - Find meeting notes</li>
                <li><code>` !!important</code> - Find important highlights</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Copy text and save as notes through the side panel!</p>
            </div>

            <!-- /command pattern -->
            <div class="pattern-card">
              <h5><code>/</code> Command Pattern</h5>
              <p><strong>What it does:</strong> Executes Superowser commands.</p>
              <p><strong>When to use:</strong> To save pages, manage tasks, or run other operations.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` /save</code> - Save current page</li>
                <li><code>` /help</code> - Show all commands</li>
                <li><code>` /task</code> - Manage tasks</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Commands also work in the Chat box!</p>
            </div>

            <!-- General search pattern -->
            <div class="pattern-card">
              <h5>General Search (no prefix)</h5>
              <p><strong>What it does:</strong> Fuzzy searches across all your saved pages, notes, and tags.</p>
              <p><strong>When to use:</strong> When you remember part of a page title or content but not the exact shortcut/tag.</p>
              <p><strong>Examples:</strong></p>
              <ul>
                <li><code>` react hooks</code> - Find pages about React hooks</li>
                <li><code>` machine learning</code> - Find ML-related content</li>
                <li><code>` api docs</code> - Find API documentation</li>
              </ul>
              <p class="pattern-tip">💡 <strong>Tip:</strong> Fuzzy search is typo-tolerant, so "mlblog" matches "ml_blog"!</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: Chat Commands -->
      <section class="help-section">
        <button @click="toggleSection('commands')" class="section-header">
          <span class="section-icon">{{ expandedSections.has('commands') ? '▼' : '▶' }}</span>
          <span class="section-title">💬 Chat Commands</span>
        </button>
        <div v-if="expandedSections.has('commands')" class="section-content">
          <p>Use slash commands in the <strong>Chat</strong> box or omnibox for quick actions:</p>

          <ul class="command-list">
            <li>
              <code>/save</code>
              <span class="command-desc">Save current page with tags, shortcut, and task</span>
            </li>
            <li>
              <code>/open @shortcut</code>
              <span class="command-desc">Open a saved page by its shortcut</span>
            </li>
            <li>
              <code>/find [query]</code>
              <span class="command-desc">Search your saved pages and notes</span>
            </li>
            <li>
              <code>/notes</code>
              <span class="command-desc">Show all your notes and highlights</span>
            </li>
            <li>
              <code>/task &name</code>
              <span class="command-desc">Set active task and show related pages</span>
            </li>
            <li>
              <code>/newtask name</code>
              <span class="command-desc">Create a new task</span>
            </li>
            <li>
              <code>/help</code>
              <span class="command-desc">Show complete command reference</span>
            </li>
          </ul>

          <div class="callout callout-info">
            💡 <strong>Pro tip:</strong> Type <code>/help</code> in the Chat box for the complete, up-to-date command reference.
            Commands work in both the omnibox (type <code class="key">`</code> in address bar) and the Chat interface!
          </div>
        </div>
      </section>

      <!-- Section 5: Tips & Tricks -->
      <section class="help-section">
        <button @click="toggleSection('tips')" class="section-header">
          <span class="section-icon">{{ expandedSections.has('tips') ? '▼' : '▶' }}</span>
          <span class="section-title">💡 Tips & Tricks</span>
        </button>
        <div v-if="expandedSections.has('tips')" class="section-content">
          <div class="tip-card">
            <h4>🏷️ Tagging Strategy</h4>
            <ul>
              <li><strong>Use broad tags</strong> like <code>#research</code>, <code>#work</code>, <code>#personal</code> for high-level organization</li>
              <li><strong>Combine with specific tags</strong> like <code>#ml</code>, <code>#backend</code>, <code>#design</code> for granular filtering</li>
              <li><strong>Keep tag names short</strong> and memorable - easier to type in searches</li>
              <li><strong>Be consistent</strong> - decide on naming conventions (e.g., singular vs plural) early</li>
            </ul>
          </div>

          <div class="tip-card">
            <h4>🎯 Shortcuts Best Practices</h4>
            <ul>
              <li><strong>Set shortcuts for frequently accessed pages</strong> - saves time over searching</li>
              <li><strong>Use memorable abbreviations</strong> - <code>@gh</code> for GitHub, <code>@gm</code> for Gmail</li>
              <li><strong>Keep them short</strong> - 2-5 characters is ideal for quick typing</li>
              <li><strong>Avoid conflicts</strong> - make sure each shortcut is unique and intuitive</li>
            </ul>
          </div>

          <div class="tip-card">
            <h4>📁 Task Organization</h4>
            <ul>
              <li><strong>Create tasks for projects</strong> - group related pages together (e.g., <code>&client-project</code>)</li>
              <li><strong>Use descriptive names</strong> - <code>&learning-ml</code> is better than <code>&misc</code></li>
              <li><strong>One active task at a time</strong> - helps maintain focus on current work</li>
              <li><strong>Review periodically</strong> - archive or delete completed tasks to keep things tidy</li>
            </ul>
          </div>

          <div class="tip-card">
            <h4>🔍 Search Optimization</h4>
            <ul>
              <li><strong>Start specific, then broaden</strong> - try shortcuts (<code>@</code>) first, then tags (<code>#</code>), then general search</li>
              <li><strong>Use fuzzy search for typos</strong> - general search is typo-tolerant</li>
              <li><strong>Save important highlights</strong> - copy text and save as notes for later <code>!!</code> searching</li>
              <li><strong>Combine patterns</strong> - use tags to organize, shortcuts for speed, tasks for projects</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// State for accordion - first 2 sections expanded by default
const expandedSections = ref<Set<string>>(new Set([
  'getting-started',
  'omnibox-trigger'
]))

const toggleSection = (sectionId: string) => {
  if (expandedSections.value.has(sectionId)) {
    expandedSections.value.delete(sectionId)
  } else {
    expandedSections.value.add(sectionId)
  }
}
</script>

<style scoped>
.help-view {
  padding: 16px;
  max-width: 900px;
}

/* Header */
.help-header {
  margin-bottom: 24px;
}

.help-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.help-subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

/* Content */
.help-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Accordion Section */
.help-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  transition: background 0.2s;
}

.section-header:hover {
  background: #f1f5f9;
}

.section-icon {
  color: #64748b;
  font-size: 12px;
  width: 16px;
  flex-shrink: 0;
}

.section-title {
  flex: 1;
  text-align: left;
}

.section-content {
  padding: 20px;
  border-top: 1px solid #e2e8f0;
  line-height: 1.6;
}

.section-content p {
  margin: 0 0 12px 0;
  color: #374151;
}

.section-content p:last-child {
  margin-bottom: 0;
}

/* Callout Boxes */
.callout {
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.callout-primary {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
}

.callout-info {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
}

.callout h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e40af;
}

.callout p {
  margin: 0;
}

.callout ul {
  margin: 8px 0 0 0;
  padding-left: 24px;
}

.callout li {
  margin-bottom: 4px;
}

/* Activation Steps */
.activation-steps {
  margin: 0;
  padding-left: 24px;
}

.activation-steps li {
  margin-bottom: 8px;
  line-height: 1.6;
  color: #1e40af;
}

/* Code Elements */
code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #dc2626;
}

.key {
  background: #3b82f6;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
}

kbd {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  border: 1px solid #cbd5e1;
  color: #1f2937;
}

/* Address Bar Visual */
.address-bar-visual {
  margin: 16px 0;
}

.address-bar-visual pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.tip-text {
  font-size: 14px;
  color: #64748b;
  font-style: italic;
  margin-top: 16px;
}

/* Patterns Table */
.patterns-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px 0;
}

.patterns-table th {
  background: #f8fafc;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
}

.patterns-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  color: #374151;
}

.patterns-table tbody tr:hover {
  background: #f8fafc;
}

/* Pattern Details */
.pattern-details {
  margin-top: 24px;
}

.pattern-details h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.pattern-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  border-left: 3px solid #3b82f6;
}

.pattern-card h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.pattern-card p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #374151;
}

.pattern-card ul {
  margin: 8px 0;
  padding-left: 20px;
}

.pattern-card li {
  margin-bottom: 6px;
  line-height: 1.5;
  font-size: 14px;
  color: #374151;
}

.pattern-tip {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  font-style: italic;
  color: #64748b;
}

/* Command List */
.command-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
}

.command-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.command-list code {
  font-size: 14px;
  font-weight: 600;
}

.command-desc {
  font-size: 13px;
  color: #64748b;
}

/* Tip Cards */
.tip-card {
  background: #fffbeb;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  border-left: 3px solid #f59e0b;
}

.tip-card h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.tip-card ul {
  margin: 0;
  padding-left: 20px;
}

.tip-card li {
  margin-bottom: 8px;
  line-height: 1.6;
  font-size: 14px;
  color: #374151;
}

.tip-card li:last-child {
  margin-bottom: 0;
}
</style>
