<script setup>
import { onBeforeUnmount, onMounted, watch, useTemplateRef, shallowRef } from 'vue'
import { EditorView, EditorState, getBaseExtensions, getLanguageExtension, darkTheme } from './codemirror.js'

const props = defineProps({
  filename: {
    type: String,
    default: 'untitled.js'
  },
  value: {
    type: String,
    default: ''
  },
  readonly: {
    type: Boolean,
    default: false
  },
  lang: {
    type: String,
    default: 'javascript'
  },
  lineNumbers: {
    type: Boolean,
    default: true
  },
  lineWrapping: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change'])
const containerRef = useTemplateRef('container')

const editor = shallowRef(null)
let resizeObserver = null

// 创建编辑器状态
function createState(doc, lang, readonly, lineNumbersEnabled, lineWrappingEnabled) {
  return EditorState.create({
    doc,
    extensions: [
      ...getBaseExtensions({ readonly, lineNumbersEnabled, lineWrappingEnabled }),
      getLanguageExtension(lang),
      darkTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('change', update.state.doc.toString())
        }
      })
    ]
  })
}

onMounted(() => {
  if (!containerRef.value) return

  const state = createState(
    props.value || '',
    props.lang,
    props.readonly,
    props.lineNumbers,
    props.lineWrapping
  )

  editor.value = new EditorView({
    state,
    parent: containerRef.value
  })

  // 使用 ResizeObserver 监听容器尺寸变化
  resizeObserver = new ResizeObserver(() => {
    editor.value?.requestMeasure()
  })
  resizeObserver.observe(containerRef.value)
})

// 监听 value 变化
watch(
  () => props.value,
  (newValue) => {
    if (editor.value && editor.value.state.doc.toString() !== newValue) {
      editor.value.dispatch({
        changes: {
          from: 0,
          to: editor.value.state.doc.length,
          insert: newValue || ''
        }
      })
    }
  }
)

// 监听 lang 变化 - 需要重建状态
watch(
  () => props.lang,
  (newLang) => {
    if (editor.value) {
      const doc = editor.value.state.doc.toString()
      editor.value.setState(createState(doc, newLang, props.readonly, props.lineNumbers, props.lineWrapping))
    }
  }
)

// 监听 readonly 变化
watch(
  () => props.readonly,
  (readonly) => {
    if (editor.value) {
      const doc = editor.value.state.doc.toString()
      editor.value.setState(createState(doc, props.lang, readonly, props.lineNumbers, props.lineWrapping))
    }
  }
)

// 监听自动换行变化
watch(
  () => props.lineWrapping,
  (lineWrapping) => {
    if (editor.value) {
      const doc = editor.value.state.doc.toString()
      editor.value.setState(createState(doc, props.lang, props.readonly, props.lineNumbers, lineWrapping))
    }
  }
)

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
})

// 暴露方法
defineExpose({
  getEditor: () => editor.value,
  getValue: () => editor.value?.state.doc.toString() || '',
  setValue: (value) => {
    if (editor.value) {
      editor.value.dispatch({
        changes: {
          from: 0,
          to: editor.value.state.doc.length,
          insert: value
        }
      })
    }
  },
  focus: () => editor.value?.focus(),
  refresh: () => editor.value?.requestMeasure(),
  // 在当前光标/选区处插入文本(替换选区),插入后光标落到文本末尾并聚焦
  insertText: (text) => {
    const view = editor.value
    if (!view) return
    const sel = view.state.selection.main
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: text },
      selection: { anchor: sel.from + text.length }
    })
    view.focus()
  }
})
</script>

<template>
  <div ref="container" class="codemirror-editor" />
</template>

<style scoped>
.codemirror-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.codemirror-editor :deep(.cm-editor) {
  height: 100%;
}

.codemirror-editor :deep(.cm-scroller) {
  overflow: auto !important;
}
</style>
