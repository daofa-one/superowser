import { createApp } from 'vue'
import AuthoringWorkspace from './AuthoringWorkspace.vue'
import './style.css'

// Configure Monaco to use local installation instead of CDN
import { loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type WorkerFactory = () => Worker

const workerFactories: Record<string, WorkerFactory> = {
  json: () => new JsonWorker(),
  css: () => new CssWorker(),
  scss: () => new CssWorker(),
  less: () => new CssWorker(),
  html: () => new HtmlWorker(),
  handlebars: () => new HtmlWorker(),
  razor: () => new HtmlWorker(),
  typescript: () => new TsWorker(),
  javascript: () => new TsWorker(),
  editor: () => new EditorWorker(),
  default: () => new EditorWorker(),
}

const createMonacoWorker: WorkerFactory = () => new EditorWorker()

const monacoEnv = {
  getWorker(_moduleId: string, label: string) {
    const factory = workerFactories[label] || workerFactories.default || createMonacoWorker
    return factory()
  }
}

if (typeof self !== 'undefined') {
  ;(self as any).MonacoEnvironment = monacoEnv
}
;(globalThis as any).MonacoEnvironment = monacoEnv
;(window as any).monaco = monaco

// Reduce worker churn for large documents
if (monaco.languages?.typescript) {
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(false)
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(false)
}

// Make sure the loader talks to our bundled Monaco instance
loader.config({
  monaco,
  'vs/nls': {
    availableLanguages: {},
  },
})

async function bootstrapAuthoringWorkspace() {
  await loader.init()

  const app = createApp(AuthoringWorkspace)
  app.mount('#app')
}

bootstrapAuthoringWorkspace().catch(error => {
  console.error('Failed to bootstrap authoring workspace:', error)
})
