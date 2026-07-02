import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { python } from '@codemirror/lang-python'
import { markdown } from '@codemirror/lang-markdown'
import { vue } from '@codemirror/lang-vue'
import { oneDark } from '@codemirror/theme-one-dark'

// 语言映射
const languageMap = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  vue: () => vue(),
  html: () => html(),
  css: () => css(),
  json: () => json(),
  sql: () => sql(),
  python: () => python(),
  markdown: () => markdown()
}

// 获取语言扩展
export function getLanguageExtension(lang) {
  const langFn = languageMap[lang]
  return langFn ? langFn() : javascript()
}

// 基础扩展配置
export function getBaseExtensions(options = {}) {
  const { readonly = false, lineNumbersEnabled = true, lineWrappingEnabled = false } = options

  const extensions = [
    // 行号必须在最前面
    lineNumbersEnabled ? lineNumbers() : [],
    lineWrappingEnabled ? EditorView.lineWrapping : [],
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    highlightSelectionMatches(),
    foldGutter(),
    oneDark,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab
    ]),
    readonly ? EditorState.readOnly.of(true) : []
  ].flat()

  return extensions
}

// 深色主题样式
export const darkTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace"
  },
  '.cm-scroller': {
    overflow: 'auto'
  },
  '.cm-content': {
    caretColor: '#fff'
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    borderRight: '1px solid #333'
  }
}, { dark: true })

export { EditorView, EditorState }
