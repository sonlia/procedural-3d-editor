<script setup>
import { ref, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, computed } from 'vue'
import * as monaco from 'monaco-editor-core'
import { initMonaco, setFile } from './env'
import { getOrCreateModel } from './utils'
import { registerHighlighter } from './highlight'

const props = defineProps({
  filename: {
    type: String,
    required: true
  },
  value: {
    type: String,
    default: ''
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change', 'ready'])

const containerRef = useTemplateRef('container')
const editorRef = shallowRef(null)
const isLoading = ref(true)

// 根据文件名获取语言
const language = computed(() => {
  const ext = props.filename.split('.').pop()?.toLowerCase() || ''
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
})

let editorInstance = null

function emitChangeEvent() {
  emit('change', editorInstance.getValue())
}

onMounted(async () => {
  // 初始化 Monaco 环境
  initMonaco()

  // 注册语法高亮
  const theme = registerHighlighter()

  if (!containerRef.value) {
    console.error('Cannot find editor container')
    return
  }

  // 注册文件到语言服务
  setFile(props.filename, props.value, language.value)

  // 创建编辑器
  editorInstance = monaco.editor.create(containerRef.value, {
    model: null,
    fontSize: 13,
    tabSize: 2,
    theme: theme.dark,
    readOnly: props.readonly,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    minimap: {
      enabled: false
    },
    inlineSuggest: {
      enabled: false
    },
    fixedOverflowWidgets: true,

    // 智能提示配置
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    parameterHints: { enabled: true },
    wordBasedSuggestions: 'allDocuments',

    // 括号配置
    bracketPairColorization: { enabled: true },
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',

    // 代码折叠
    folding: true,
    foldingStrategy: 'indentation'
  })

  editorRef.value = editorInstance

  // 支持语义高亮
  const t = editorInstance._themeService._theme
  t.semanticHighlighting = true
  t.getTokenStyleMetadata = (type, modifiers, _language) => {
    const _readonly = modifiers.includes('readonly')
    switch (type) {
      case 'function':
      case 'method':
        return { foreground: 12 }
      case 'class':
        return { foreground: 11 }
      case 'variable':
      case 'property':
        return { foreground: _readonly ? 19 : 9 }
      default:
        return { foreground: 0 }
    }
  }

  // 设置初始 model
  const uri = monaco.Uri.parse(`file:///${props.filename}`)
  const model = getOrCreateModel(uri, language.value, props.value)
  editorInstance.setModel(model)

  // 监听内容变化
  if (!props.readonly) {
    editorInstance.onDidChangeModelContent(() => {
      emitChangeEvent()
    })
  }

  // 禁用 Ctrl+S
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    // 忽略保存事件，但触发 change
    emitChangeEvent()
  })

  isLoading.value = false
  emit('ready', editorInstance)
})

// 监听 value 变化
watch(
  () => props.value,
  (value) => {
    if (editorInstance && editorInstance.getValue() !== value) {
      editorInstance.setValue(value || '')
    }
  }
)

// 监听 filename 变化
watch(
  () => props.filename,
  (newFilename) => {
    if (!editorInstance) return

    // 注册新文件
    setFile(newFilename, props.value, language.value)

    // 创建新的 model
    const uri = monaco.Uri.parse(`file:///${newFilename}`)
    const model = getOrCreateModel(uri, language.value, props.value)
    editorInstance.setModel(model)
  }
)

// 监听 readonly 变化
watch(
  () => props.readonly,
  (readonly) => {
    if (editorInstance) {
      editorInstance.updateOptions({ readOnly: readonly })
    }
  }
)

onBeforeUnmount(() => {
  editorRef.value?.dispose()
})

// 暴露方法
defineExpose({
  getEditor: () => editorRef.value,
  getValue: () => editorRef.value?.getValue() || '',
  setValue: (value) => editorRef.value?.setValue(value),
  focus: () => editorRef.value?.focus()
})
</script>

<template>
  <div class="monaco-editor-wrapper">
    <div ref="container" class="editor-container" />
    <div v-if="isLoading" class="loading-overlay">
      <q-spinner-dots color="primary" size="32px" />
      <span class="q-ml-sm text-grey-5">加载编辑器...</span>
    </div>
  </div>
</template>

<style scoped>
.monaco-editor-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.editor-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
  z-index: 10;
}
</style>
