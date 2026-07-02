import { createNpmFileSystem } from '@volar/jsdelivr'
import {
  createTypeScriptWorkerLanguageService
} from '@volar/monaco/worker'
import {
  VueVirtualCode,
  createVueLanguagePlugin,
  getDefaultCompilerOptions,
  generateGlobalTypes,
  getGlobalTypesFileName
} from '@vue/language-core'
import {
  createVueLanguageServicePlugins
} from '@vue/language-service'
import * as worker from 'monaco-editor-core/esm/vs/editor/editor.worker'
import { create as createTypeScriptDirectiveCommentPlugin } from 'volar-service-typescript/lib/plugins/directiveComment'
import { create as createTypeScriptSemanticPlugin } from 'volar-service-typescript/lib/plugins/semantic'
import { URI } from 'vscode-uri'

import { preprocessLanguageService, postprocessLanguageService } from '@vue/typescript-plugin/lib/common'
import { getComponentDirectives } from '@vue/typescript-plugin/lib/requests/getComponentDirectives'
import { getComponentEvents } from '@vue/typescript-plugin/lib/requests/getComponentEvents'
import { getComponentNames } from '@vue/typescript-plugin/lib/requests/getComponentNames'
import { getComponentProps } from '@vue/typescript-plugin/lib/requests/getComponentProps'
import { getComponentSlots } from '@vue/typescript-plugin/lib/requests/getComponentSlots'
import { getElementAttrs } from '@vue/typescript-plugin/lib/requests/getElementAttrs'
import { getElementNames } from '@vue/typescript-plugin/lib/requests/getElementNames'
import { isRefAtPosition } from '@vue/typescript-plugin/lib/requests/isRefAtPosition'

// 直接导入本地 TypeScript
import * as typescript from 'typescript'

const asFileName = (uri) => uri.path
const asUri = (fileName) => URI.file(fileName)

// 使用本地导入的 TypeScript
const ts = typescript
let locale

self.onmessage = async (msg) => {
  if (msg.data?.event === 'init') {
    locale = msg.data.tsLocale
    // TypeScript 已通过静态导入加载，直接通知初始化完成
    self.postMessage('inited')
    return
  }

  worker.initialize((ctx, { tsconfig, dependencies }) => {
    const env = {
      workspaceFolders: [URI.file('/')],
      locale,
      fs: createNpmFileSystem(
        (uri) => {
          if (uri.scheme === 'file') {
            if (uri.path === '/node_modules') {
              return ''
            } else if (uri.path.startsWith('/node_modules/')) {
              return uri.path.slice('/node_modules/'.length)
            }
          }
        },
        (pkgName) => dependencies[pkgName],
        (path, content) => {
          ctx.host.onFetchCdnFile(
            asUri('/node_modules/' + path).toString(),
            content
          )
        }
      )
    }

    const { options: compilerOptions } = ts.convertCompilerOptionsFromJson(
      tsconfig?.compilerOptions || {},
      ''
    )
    const vueCompilerOptions = {
      ...getDefaultCompilerOptions(),
      ...tsconfig.vueCompilerOptions
    }
    setupGlobalTypes(vueCompilerOptions, env)

    const workerService = createTypeScriptWorkerLanguageService({
      typescript: ts,
      compilerOptions,
      workerContext: ctx,
      env,
      uriConverter: {
        asFileName,
        asUri
      },
      languagePlugins: [
        createVueLanguagePlugin(
          ts,
          compilerOptions,
          vueCompilerOptions,
          asFileName
        )
      ],
      languageServicePlugins: [
        ...getTsLanguageServicePlugins(),
        ...getVueLanguageServicePlugins()
      ]
    })

    return workerService

    function setupGlobalTypes(options, env) {
      const globalTypes = generateGlobalTypes(options)
      const globalTypesPath =
        '/node_modules/' + getGlobalTypesFileName(options)
      options.globalTypesPath = () => globalTypesPath
      const { stat, readFile } = env.fs
      const ctime = Date.now()
      env.fs.stat = async (uri) => {
        if (uri.path === globalTypesPath) {
          return {
            type: 1,
            ctime: ctime,
            mtime: ctime,
            size: globalTypes.length
          }
        }
        return stat(uri)
      }
      env.fs.readFile = async (uri) => {
        if (uri.path === globalTypesPath) {
          return globalTypes
        }
        return readFile(uri)
      }
    }

    function getTsLanguageServicePlugins() {
      const semanticPlugin = createTypeScriptSemanticPlugin(ts)
      const { create } = semanticPlugin
      semanticPlugin.create = (context) => {
        const created = create(context)
        const ls = created.provide['typescript/languageService']()
        preprocessLanguageService(ls, () => context.language)
        const proxy = postprocessLanguageService(
          ts,
          context.language,
          ls,
          vueCompilerOptions,
          asUri
        )
        ls.getCompletionsAtPosition = proxy.getCompletionsAtPosition
        ls.getCompletionEntryDetails = proxy.getCompletionEntryDetails
        ls.getCodeFixesAtPosition = proxy.getCodeFixesAtPosition
        ls.getDefinitionAndBoundSpan = proxy.getDefinitionAndBoundSpan
        return created
      }
      return [semanticPlugin, createTypeScriptDirectiveCommentPlugin()]
    }

    function getVueLanguageServicePlugins() {
      const plugins = createVueLanguageServicePlugins(ts, {
        getComponentDirectives(fileName) {
          return getComponentDirectives(ts, getProgram(), fileName)
        },
        getComponentNames(fileName) {
          return getComponentNames(ts, getProgram(), fileName)
        },
        getComponentProps(fileName, tag) {
          return getComponentProps(ts, getProgram(), fileName, tag)
        },
        getComponentEvents(fileName, tag) {
          return getComponentEvents(ts, getProgram(), fileName, tag)
        },
        getComponentSlots(fileName) {
          const { virtualCode } = getVirtualCode(fileName)
          return getComponentSlots(ts, getProgram(), virtualCode)
        },
        getElementAttrs(fileName, tag) {
          return getElementAttrs(ts, getProgram(), fileName, tag)
        },
        getElementNames(fileName) {
          return getElementNames(ts, getProgram(), fileName)
        },
        isRefAtPosition(fileName, position) {
          const { sourceScript, virtualCode } = getVirtualCode(fileName)
          return isRefAtPosition(
            ts,
            getLanguageService().context.language,
            getProgram(),
            sourceScript,
            virtualCode,
            position
          )
        },
        async getQuickInfoAtPosition(fileName, position) {
          const uri = asUri(fileName)
          const sourceScript =
            getLanguageService().context.language.scripts.get(uri)
          if (!sourceScript) {
            return
          }
          const hover = await getLanguageService().getHover(uri, position)
          let text = ''
          if (typeof hover?.contents === 'string') {
            text = hover.contents
          } else if (Array.isArray(hover?.contents)) {
            text = hover.contents
              .map((c) => (typeof c === 'string' ? c : c.value))
              .join('\n')
          } else if (hover) {
            text = hover.contents.value
          }
          text = text.replace(/```typescript/g, '')
          text = text.replace(/```/g, '')
          text = text.replace(/---/g, '')
          text = text.trim()
          while (true) {
            const newText = text.replace(/\n\n/g, '\n')
            if (newText === text) {
              break
            }
            text = newText
          }
          text = text.replace(/\n/g, ' | ')
          return text
        },
        collectExtractProps() {
          throw new Error('Not implemented')
        },
        getImportPathForFile() {
          throw new Error('Not implemented')
        },
        resolveModuleName() {
          throw new Error('Not implemented')
        },
        getDocumentHighlights() {
          throw new Error('Not implemented')
        },
        getEncodedSemanticClassifications() {
          throw new Error('Not implemented')
        },
        getAutoImportSuggestions() {
          throw new Error('Not implemented')
        },
        resolveAutoImportCompletionEntry() {
          throw new Error('Not implemented')
        }
      })
      const ignoreVueServicePlugins = new Set([
        'vue-extract-file',
        'vue-document-drop',
        'vue-document-highlights',
        'typescript-semantic-tokens',
        // 以下插件在 Web 环境中不可用
        'emmet (stub)',
        'pug-beautify',
        'vue-template (html)',
        'vue-template (jade)',
        'css'
      ])
      return plugins.filter(
        (plugin) => !ignoreVueServicePlugins.has(plugin.name)
      )

      function getVirtualCode(fileName) {
        const uri = asUri(fileName)
        const sourceScript =
          getLanguageService().context.language.scripts.get(uri)
        if (!sourceScript) {
          throw new Error('No source script found for file: ' + fileName)
        }
        const virtualCode = sourceScript.generated?.root
        if (!(virtualCode instanceof VueVirtualCode)) {
          throw new Error('No virtual code found for file: ' + fileName)
        }
        return {
          sourceScript,
          virtualCode
        }
      }

      function getProgram() {
        const tsService =
          getLanguageService().context.inject('typescript/languageService')
        return tsService.getProgram()
      }

      function getLanguageService() {
        return workerService.languageService
      }
    }
  })
}
