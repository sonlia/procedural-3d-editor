import { editor } from 'monaco-editor-core'

export function getOrCreateModel(uri, lang, value) {
  const model = editor.getModel(uri)
  if (model) {
    model.setValue(value)
    return model
  }
  return editor.createModel(value, lang, uri)
}
