// @injected - this file is imported as raw text into preview templates.

const EDITOR_BEHAVIOR_OVERRIDES = {};

const isChildrenEmpty = (c) => {
  if (c == null || c === '') return true;
  if (Array.isArray(c) && c.length === 0) return true;
  if (typeof c === 'function') return isChildrenEmpty(c());
  if (typeof c === 'object' && !Array.isArray(c)) {
    return Object.values(c).every(slot => isChildrenEmpty(slot));
  }
  return false;
};

const getTagName = (tag) =>
  typeof tag === 'string' ? tag : (tag.name || tag.__name || 'Component');

const createSurrogateEditorNode = (id, tagName, label, preview, editorStyle, children) => {
  return h('div', {
    nodeid: id,
    class: 'vs-edit-node vs-surrogate-node',
    style: editorStyle || undefined,
    'data-tag': tagName,
    'data-editor-label': label,
    'data-editor-reason': preview.reason || 'surrogate',
  }, children);
};

const wrapChildrenWithDropZones = (children, parentId) => {
  if (!Array.isArray(children)) return children;

  if (children.length === 0) {
    return [h('div', {
      class: 'vs-drop-zone vs-drop-zone--empty',
      slot: 'default',
      nodeid: parentId,
      'data-label': 'drop zone'
    })];
  }

  return children.map((child, i) => {
    if (child == null || typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
      return child;
    }
    return h('div', {
      class: 'vs-drop-zone',
      slot: 'default',
      nodeid: parentId,
      'data-index': String(i),
      'data-label': 'slot[' + i + ']'
    }, [child]);
  });
};

function createEditorNode(tag, id, props, children) {
  const {
    __editorBehavior,
    __editorPreview,
    __editorLabel,
    __editorStyle,
    __gridLayout,
    __gridConfig,
    __layoutNode,
    __layoutPart,
    ...restProps
  } = props || {};
  const hasInnerHTML = typeof restProps.innerHTML === "string" && restProps.innerHTML.length > 0;
  const isEmpty = hasInnerHTML ? false : isChildrenEmpty(children);
  const tagName = getTagName(tag);
  const editorLabel = __editorLabel || tagName;
  const editorAttrs = { 'data-tag': tagName, 'data-editor-label': editorLabel };

  const styleStr = restProps.style || '';
  const isGridContainer = typeof styleStr === 'string' && /display\s*:\s*(inline-)?grid/.test(styleStr);
  const isLayoutNode = !!__layoutNode;
  const isArrayContainer = !hasInnerHTML && Array.isArray(children);
  const processedChildren = (isArrayContainer && !isGridContainer && !isLayoutNode)
    ? wrapChildrenWithDropZones(children, id)
    : children;
  const skipEmptyHint = isArrayContainer && !isGridContainer;

  const behavior = __layoutPart && __editorBehavior?.mode === "placeholder"
    ? EDITOR_BEHAVIOR_OVERRIDES[tagName]
    : EDITOR_BEHAVIOR_OVERRIDES[tagName] || __editorBehavior;

  const editorPreview = __editorPreview || (behavior?.mode === 'surrogate' ? behavior : null);
  if (editorPreview?.visibility === 'surrogate' || editorPreview?.mode === 'surrogate') {
    return createSurrogateEditorNode(id, tagName, editorLabel, editorPreview, __editorStyle, processedChildren);
  }

  if (behavior) {
    if (behavior.mode === 'forceRender') {
      const forcedProps = { ...restProps, ...(behavior.propsOverride || {}) };
      const extraClass = behavior.fullHeight ? ' vs-full-height' : '';
      const emptyClass = (isEmpty && !skipEmptyHint) ? ' vs-empty-node' : '';
      return h(tag, mergeProps(
        { nodeid: id, ...forcedProps },
        {
          class: 'vs-edit-node' + emptyClass + extraClass,
          style: __editorStyle || undefined,
          ...editorAttrs,
        }
      ), processedChildren);
    }

    if (behavior.mode === 'placeholder') {
      return h('div', {
        nodeid: id,
        class: (isEmpty && !skipEmptyHint) ? 'vs-edit-node vs-placeholder-node vs-empty-node' : 'vs-edit-node vs-placeholder-node',
        style: __editorStyle || undefined,
        ...editorAttrs,
        'data-reason': behavior.reason || ''
      }, processedChildren);
    }
  }

  if (isEmpty && isGridContainer && typeof tag === 'string') {
    return h(tag, mergeProps(
      { nodeid: id, ...restProps },
      { class: 'vs-edit-node vs-empty-grid', style: __editorStyle || undefined, ...editorAttrs }
    ));
  }

  const needsEmptyHint = isEmpty && typeof tag === 'string' && !skipEmptyHint;

  return h(tag, mergeProps(
    { nodeid: id, ...restProps },
    {
      class: needsEmptyHint ? 'vs-edit-node vs-empty-node' : 'vs-edit-node',
      style: __editorStyle || undefined,
      ...editorAttrs,
    }
  ), processedChildren);
}
