import { defineManifest } from '@crxjs/vite-plugin'
import packageJson from './package.json'

const { version, name, description, displayName } = packageJson
// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = '0'] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, '')
  // split into version parts
  .split(/[.-]/)

export default defineManifest(async (env) => ({
  name: env.mode === 'staging' ? `[INTERNAL] ${name}` : displayName || name,
  description,
  // up to four numbers separated by dots
  version: `${major}.${minor}.${patch}.${label}`,
  // semver is OK in "version_name"
  version_name: version,
  manifest_version: 3,
  "omnibox": {
    "keyword": '`'
  },
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  },
  action: {
    default_title: 'Superowser'
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: "module",
  },
  content_scripts: [
    {
      all_frames: false,
      js: ['src/content/index.ts'],
      matches: ['*://*/*', '<all_urls>'],
      run_at: 'document_start',
    },
  ],
  host_permissions: ['*://*/*', '<all_urls>'],
  side_panel: {
    default_path: 'sidepanel/index.html'
  },
  options_ui: {
    page: 'options/index.html',
    open_in_tab: true
  },
  permissions: [
    'storage',
    'unlimitedStorage',
    'tabs',
    'activeTab',
    'background',
    'contextMenus',
    'favicon',
    'sidePanel',
    'omnibox',
    'scripting'
  ],
  web_accessible_resources: [
    {
      resources: [
        'authoring/index.html',
        'assets/*'
      ],
      matches: ['<all_urls>']
    }
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';"
  },
}))
