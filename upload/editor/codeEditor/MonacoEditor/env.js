import * as volar from '@volar/monaco'
import { Uri, editor, languages } from 'monaco-editor-core'
import editorWorker from 'monaco-editor-core/esm/vs/editor/editor.worker?worker'
import { getOrCreateModel } from './utils'
import vueWorker from './vue.worker?worker'
import * as languageConfigs from './language-configs'

let initted = false

// 默认依赖版本
const defaultDependencies = {
  vue: '3.5.13',
  '@vue/compiler-core': '3.5.13',
  '@vue/compiler-dom': '3.5.13',
  '@vue/compiler-sfc': '3.5.13',
  '@vue/compiler-ssr': '3.5.13',
  '@vue/reactivity': '3.5.13',
  '@vue/runtime-core': '3.5.13',
  '@vue/runtime-dom': '3.5.13',
  '@vue/shared': '3.5.13',
  typescript: '5.6.3'
}

// 文件存储
const files = {}

export function initMonaco() {
  if (initted) return
  loadMonacoEnv()
  initted = true
}

// 添加或更新文件
export function setFile(filename, code, language) {
  const lang = language || getLanguageFromFilename(filename)
  files[filename] = { code, language: lang }

  // 创建或更新 Monaco model
  const uri = Uri.parse(`file:///${filename}`)
  getOrCreateModel(uri, lang, code)
}

// 删除文件
export function removeFile(filename) {
  delete files[filename]
  const model = editor.getModel(Uri.parse(`file:///${filename}`))
  if (model) {
    model.dispose()
  }
}

// 获取所有文件
export function getFiles() {
  return files
}

// 根据文件名获取语言
function getLanguageFromFilename(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const langMap = {
    vue: 'vue',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    md: 'markdown'
  }
  return langMap[ext] || 'javascript'
}

export class WorkerHost {
  onFetchCdnFile(uri, text) {
    getOrCreateModel(Uri.parse(uri), undefined, text)
  }
}

let disposeVue

export async function reloadLanguageTools() {
  disposeVue?.()

  const worker = editor.createWebWorker({
    moduleId: 'vs/language/vue/vueWorker',
    label: 'vue',
    host: new WorkerHost(),
    createData: {
      tsconfig: {},
      dependencies: defaultDependencies
    }
  })

  const languageId = ['vue', 'javascript', 'typescript']
  const getSyncUris = () =>
    Object.keys(files).map((filename) => Uri.parse(`file:///${filename}`))

  const { dispose: disposeMarkers } = volar.activateMarkers(
    worker,
    languageId,
    'vue',
    getSyncUris,
    editor
  )

  const { dispose: disposeAutoInsertion } = volar.activateAutoInsertion(
    worker,
    languageId,
    getSyncUris,
    editor
  )

  const { dispose: disposeProvides } = await volar.registerProviders(
    worker,
    languageId,
    getSyncUris,
    languages
  )

  disposeVue = () => {
    disposeMarkers()
    disposeAutoInsertion()
    disposeProvides()
  }
}

// 简单的 debounce 实现
function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

let languageToolsPromise
const debouncedReloadLanguageTools = debounce(async () => {
  ;(languageToolsPromise ||= reloadLanguageTools()).finally(() => {
    languageToolsPromise = undefined
  })
}, 250)

export function loadMonacoEnv() {
  self.MonacoEnvironment = {
    async getWorker(_, label) {
      if (label === 'vue') {
        const worker = new vueWorker()
        const init = new Promise((resolve) => {
          worker.addEventListener('message', (data) => {
            if (data.data === 'inited') {
              resolve()
            }
          })
          worker.postMessage({
            event: 'init',
            tsVersion: defaultDependencies.typescript,
            tsLocale: undefined
          })
        })
        await init
        return worker
      }
      return new editorWorker()
    }
  }

  // 注册语言
  languages.register({ id: 'vue', extensions: ['.vue'] })
  languages.register({ id: 'javascript', extensions: ['.js', '.jsx'] })
  languages.register({ id: 'typescript', extensions: ['.ts', '.tsx'] })
  languages.register({ id: 'css', extensions: ['.css'] })
  languages.register({ id: 'json', extensions: ['.json'] })
  languages.register({ id: 'html', extensions: ['.html'] })

  // 设置语言配置
  languages.setLanguageConfiguration('vue', languageConfigs.vue)
  languages.setLanguageConfiguration('javascript', languageConfigs.js)
  languages.setLanguageConfiguration('typescript', languageConfigs.ts)
  languages.setLanguageConfiguration('css', languageConfigs.css)

  // 当 Vue 语言激活时，加载语言工具
  languages.onLanguage('vue', () => debouncedReloadLanguageTools())
}
