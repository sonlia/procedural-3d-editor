import { computed } from 'vue'
import { useProjectStore } from 'src/stores/projectMange.js'
import { getGraphInstance } from 'src/components/editor/nodeEditor/composables/useLitegraphEditor.js'
import { Notify } from 'quasar'

// 所有新的 styleClass 键
export const STYLE_KEYS = [
  // 容器布局
  'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gutter',
  // 在父级中
  'colSize', 'colOffset', 'colShrink', 'selfAlign', 'order',
  // 间距
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  // 定位
  'position',
  // 尺寸
  'sizeWidth', 'sizeHeight',
  // 外观
  'textColor', 'bgColor', 'fontSize', 'shadow', 'fontWeight', 'textAlign',
  'textDecoration', 'overflow',
  // 其他
  'visibility', 'borderStyles', 'scrollAll', 'scrollX', 'scrollY', 'hideScrollbar',
  'mouseStyles', 'transform',
]

// 分区键组（用于分区清除）
export const SECTION_KEYS = {
  container: ['flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gutter'],
  inParent: ['colSize', 'colOffset', 'colShrink', 'selfAlign', 'order'],
  spacing: [
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  ],
  position: ['position'],
  size: ['sizeWidth', 'sizeHeight'],
  appearance: ['textColor', 'bgColor', 'fontSize', 'shadow', 'fontWeight', 'textAlign', 'textDecoration', 'overflow'],
  behavior: ['visibility', 'borderStyles', 'scrollAll', 'scrollX', 'scrollY', 'hideScrollbar', 'mouseStyles', 'transform'],
}

// 字号离散步进：索引 → class
export const FONT_SIZE_STEPS = [
  'text-h1', 'text-h2', 'text-h3', 'text-h4', 'text-h5', 'text-h6',
  'text-subtitle1', 'text-subtitle2', 'text-body1', 'text-body2',
  'text-caption', 'text-overline',
]

// 字号标签
export const FONT_SIZE_LABELS = {
  'text-h1': 'H1', 'text-h2': 'H2', 'text-h3': 'H3',
  'text-h4': 'H4', 'text-h5': 'H5', 'text-h6': 'H6',
  'text-subtitle1': 'Sub1', 'text-subtitle2': 'Sub2',
  'text-body1': 'Body1', 'text-body2': 'Body2',
  'text-caption': 'Cap', 'text-overline': 'Over',
}

// 间距尺寸选项
export const SPACING_SIZES = ['none', 'xs', 'sm', 'md', 'lg', 'xl']

// 值为数组类型的键（其余均为 string | undefined）
export const ARRAY_KEYS = new Set(['visibility', 'textDecoration', 'borderStyles'])

// 定位值常量集合（用于类型判断，避免 startsWith 反向推断）
export const CONTAINER_POSITIONS = new Set([
  'absolute-top-left', 'absolute-top', 'absolute-top-right',
  'absolute-left', 'absolute-center', 'absolute-right',
  'absolute-bottom-left', 'absolute-bottom', 'absolute-bottom-right',
  'relative-position',
])

export const SCREEN_POSITIONS = new Set([
  'fixed-top', 'fixed-bottom', 'fixed-left', 'fixed-right',
  'fixed-top-left', 'fixed-top-right', 'fixed-bottom-left', 'fixed-bottom-right',
  'fixed-center',
])

// 旧格式迁移映射（注意：optionShaddows 是旧数据中的拼写错误，不可修改）
const MIGRATION_MAP = {
  optionShaddows: 'shadow',
  flexParent: 'flexDirection',
  flexWrapStyles: 'flexWrap',
  flexItemAlignX: 'justifyContent',
  flexItemAlignY: 'alignItems',
  flexContentAlign: 'alignContent',
  flexItemSize: 'colSize',
  flexItemAlign: 'selfAlign',
  flexItemOrder: 'order',
  scrollStyles: 'scrollAll',
  options_headings: 'fontSize',
  optionWeights: 'fontWeight',
  directionStyles: 'transform',
}

// 间距类名解析映射
const SPACING_KEY_MAP = {
  pa: 'padding', pt: 'paddingTop', pr: 'paddingRight', pb: 'paddingBottom', pl: 'paddingLeft',
  ma: 'margin', mt: 'marginTop', mr: 'marginRight', mb: 'marginBottom', ml: 'marginLeft',
}

export function useStyleData(selectNode) {
  const projectStore = useProjectStore()

  // === 树遍历 ===
  const getTreeData = () => projectStore.getEditorData('dragEditor') || []

  const findParentNode = (nodeId) => {
    let result = null
    const walk = (nodes, parent) => {
      if (!nodes || !Array.isArray(nodes)) return false
      for (const node of nodes) {
        if (!node) continue
        if (node.id === nodeId) { result = parent; return true }
        if (node.children) {
          if (Array.isArray(node.children)) {
            if (walk(node.children, node)) return true
          } else if (typeof node.children === 'object') {
            for (const slot in node.children) {
              if (Array.isArray(node.children[slot]) && walk(node.children[slot], node)) return true
            }
          }
        }
      }
      return false
    }
    walk(getTreeData(), null)
    return result
  }

  // === 计算属性 ===
  const styleClass = computed(() => selectNode.value?.properties?.styleClass)

  const currentTag = computed(() => selectNode.value?.tag || selectNode.value?.type || '')

  const parentNode = computed(() => {
    if (!selectNode.value?.id) return null
    return findParentNode(selectNode.value.id)
  })

  const parentTag = computed(() => parentNode.value?.tag || parentNode.value?.type || '')

  // 通过 LiteGraph graph 获取父节点的真实 styleClass
  // dragEditor 树节点的 properties 与 LiteGraph 节点独立，需要通过 graph.getNodeById 查找
  const parentStyleClass = computed(() => {
    const parent = parentNode.value
    if (!parent?.id) return {}
    const graph = getGraphInstance()
    const lgNode = graph?.getNodeById?.(parent.id)
    return lgNode?.properties?.styleClass || parent?.properties?.styleClass || {}
  })

  const FLEX_DIRECTIONS = ['row', 'column', 'row reverse', 'column reverse', 'row inline', 'column inline']

  const isParentFlex = computed(() => {
    const parent = parentNode.value
    if (!parent?.id) return false
    const graph = getGraphInstance()
    const lgNode = graph?.getNodeById?.(parent.id)
    // grid 模式下不算 flex（新格式或旧格式）
    if (lgNode?.properties?.gridConfig) return false
    if (lgNode?.nodeRawData?.meta?.layoutType === 'grid') return false

    const dir = parentStyleClass.value?.flexDirection
    if (dir && FLEX_DIRECTIONS.includes(dir)) return true
    // 兜底：通过 LiteGraph 父节点的 meta.layoutType 判断
    return lgNode?.nodeRawData?.meta?.layoutType === 'flex'
  })

  const parentFlexDirection = computed(() => {
    if (!isParentFlex.value) return null
    return parentStyleClass.value.flexDirection || 'row'
  })

  const isFlexContainer = computed(() => {
    return !!styleClass.value?.flexDirection
  })

  const hasChildren = computed(() => {
    const node = selectNode.value
    if (!node?.children) return false
    if (Array.isArray(node.children)) return node.children.length > 0
    if (typeof node.children === 'object') {
      return Object.values(node.children).some(arr => Array.isArray(arr) && arr.length > 0)
    }
    return false
  })

  // === 数据操作 ===
  const getValue = (key) => styleClass.value?.[key]

  const setValue = (key, value) => {
    if (!selectNode.value?.properties) return
    if (!selectNode.value.properties.styleClass) {
      selectNode.value.properties.styleClass = {}
    }
    selectNode.value.properties.styleClass[key] = (value === '' || value === null) ? undefined : value
  }

  const toggleValue = (key, value) => {
    if (getValue(key) === value) {
      setValue(key, undefined)
    } else {
      setValue(key, value)
    }
  }

  const toggleArrayValue = (key, value) => {
    const arr = getValue(key) || []
    const idx = arr.indexOf(value)
    if (idx !== -1) {
      const newArr = [...arr]
      newArr.splice(idx, 1)
      setValue(key, newArr.length > 0 ? newArr : undefined)
    } else {
      setValue(key, [...arr, value])
    }
  }

  const clearSection = (sectionName) => {
    const keys = SECTION_KEYS[sectionName]
    if (!keys) return
    keys.forEach(k => setValue(k, undefined))
  }

  const sectionHasValue = (sectionName) => {
    const keys = SECTION_KEYS[sectionName]
    if (!keys) return false
    return keys.some(k => {
      const v = getValue(k)
      if (v === undefined || v === null || v === '') return false
      if (Array.isArray(v)) return v.length > 0
      return true
    })
  }

  // === 快捷布局 ===
  const applyQuickLayout = (type) => {
    const layoutKeys = ['flexDirection', 'flexWrap', 'justifyContent', 'alignItems']
    layoutKeys.forEach(k => setValue(k, undefined))

    switch (type) {
      case 'center-h':
        setValue('flexDirection', 'row')
        setValue('justifyContent', 'justify-center')
        break
      case 'center-v':
        setValue('flexDirection', 'column')
        setValue('justifyContent', 'justify-center')
        break
      case 'center-all':
        setValue('flexDirection', 'row')
        setValue('justifyContent', 'justify-center')
        setValue('alignItems', 'items-center')
        break
      case 'fill':
        setValue('sizeWidth', 'full-width')
        setValue('sizeHeight', 'full-height')
        break
    }
  }

  // === 汇总 ===
  const allClasses = computed(() => {
    const classes = []
    if (!styleClass.value) return classes
    for (const key of STYLE_KEYS) {
      const val = styleClass.value[key]
      if (val === undefined || val === null || val === '') continue
      if (Array.isArray(val)) {
        val.forEach(v => { if (v) classes.push(v) })
      } else {
        classes.push(val)
      }
    }
    return classes
  })

  const removeClass = (className) => {
    if (!styleClass.value) return
    for (const key of STYLE_KEYS) {
      const val = styleClass.value[key]
      if (Array.isArray(val)) {
        const idx = val.indexOf(className)
        if (idx !== -1) {
          const newArr = [...val]
          newArr.splice(idx, 1)
          setValue(key, newArr.length > 0 ? newArr : undefined)
          return
        }
      } else if (val === className) {
        setValue(key, undefined)
        return
      }
    }
  }

  const resetAll = () => {
    STYLE_KEYS.forEach(k => setValue(k, undefined))
  }

  // === Inline style 字符串读写（用于 utility class 无法覆盖的值，如自定义宽高 px/rem/%）===
  const parseInlineStyle = (str) => {
    if (!str || typeof str !== 'string') return {}
    const result = {}
    str.split(';').forEach(part => {
      const idx = part.indexOf(':')
      if (idx === -1) return
      const key = part.slice(0, idx).trim()
      const val = part.slice(idx + 1).trim()
      if (key) result[key] = val
    })
    return result
  }

  const stringifyInlineStyle = (obj) => {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
  }

  const getInlineStyle = (prop) => {
    const str = selectNode.value?.properties?.style
    if (!str) return undefined
    return parseInlineStyle(str)[prop]
  }

  const setInlineStyle = (prop, value) => {
    if (!selectNode.value?.properties) return
    const current = parseInlineStyle(selectNode.value.properties.style || '')
    if (value === undefined || value === null || value === '') {
      delete current[prop]
    } else {
      current[prop] = value
    }
    selectNode.value.properties.style = stringifyInlineStyle(current)
  }

  // === 修改父级样式（用于定位自动处理） ===
  const setParentValue = (key, value) => {
    if (!parentNode.value?.properties) return
    if (!parentNode.value.properties.styleClass) {
      parentNode.value.properties.styleClass = {}
    }
    parentNode.value.properties.styleClass[key] = value
    Notify.create({ type: 'info', message: `已自动为父级 ${parentTag.value} 添加 relative-position`, timeout: 2000 })
  }

  // === 初始化 & 迁移 ===
  const initStyleClass = () => {
    if (!selectNode.value?.properties) return

    const existing = selectNode.value.properties.styleClass
    if (!existing) {
      selectNode.value.properties.styleClass = {}
      return
    }

    const hasOldKeys = Object.keys(MIGRATION_MAP).some(k => existing[k] !== undefined)
    const hasOtherOld = existing.spacingStyles !== undefined ||
      existing.assistantTool !== undefined ||
      existing.sizeStyles !== undefined
    if (hasOldKeys || hasOtherOld) {
      migrateStyleClass(existing)
    }
  }

  const migrateStyleClass = (data) => {
    for (const [oldKey, newKey] of Object.entries(MIGRATION_MAP)) {
      if (data[oldKey] !== undefined) {
        if (data[newKey] === undefined) data[newKey] = data[oldKey]
        delete data[oldKey]
      }
    }

    if (data.spacingStyles !== undefined && data.spacingStyles) {
      const val = data.spacingStyles
      const match = val.match(/^q-(p|m)(t|r|b|l|a|x|y)-(none|auto|xs|sm|md|lg|xl)$/)
      if (match) {
        const [, prefix, pos] = match
        const newKey = SPACING_KEY_MAP[prefix + pos]
        if (newKey && data[newKey] === undefined) data[newKey] = val
      }
      delete data.spacingStyles
    }

    if (data.sizeStyles !== undefined && data.sizeStyles) {
      const val = data.sizeStyles
      if (val === 'fit') {
        if (!data.sizeWidth) data.sizeWidth = 'full-width'
        if (!data.sizeHeight) data.sizeHeight = 'full-height'
      } else if (['full-width', 'window-width'].includes(val)) {
        if (!data.sizeWidth) data.sizeWidth = val
      } else if (['full-height', 'window-height'].includes(val)) {
        if (!data.sizeHeight) data.sizeHeight = val
      }
      delete data.sizeStyles
    }

    if (data.assistantTool !== undefined && Array.isArray(data.assistantTool)) {
      const alignClasses = ['text-right', 'text-left', 'text-center', 'text-justify']
      const decorations = []
      for (const cls of data.assistantTool) {
        if (alignClasses.includes(cls)) {
          if (!data.textAlign) data.textAlign = cls
        } else {
          decorations.push(cls)
        }
      }
      if (decorations.length > 0 && !data.textDecoration) {
        data.textDecoration = decorations
      }
      delete data.assistantTool
    }

    ;['breakpoints', 'bodyClasses'].forEach(k => delete data[k])
  }

  initStyleClass()

  return {
    styleClass,
    currentTag,
    parentNode, parentTag, parentStyleClass,
    isParentFlex, parentFlexDirection,
    isFlexContainer, hasChildren,
    getValue, setValue, toggleValue, toggleArrayValue,
    getInlineStyle, setInlineStyle,
    clearSection, sectionHasValue,
    applyQuickLayout,
    allClasses, removeClass, resetAll,
    setParentValue,
    SECTION_KEYS,
  }
}
