/**
 * Node Graph Visual Constants
 * Colors, sizes, fonts for node graph rendering
 */

export const NODE_GRAPH_COLORS = {
  /** Background grid */
  gridSmall: 'rgba(255, 255, 255, 0.04)',
  gridLarge: 'rgba(255, 255, 255, 0.08)',
  gridOrigin: 'rgba(83, 82, 237, 0.25)',

  /** Node base */
  nodeBackground: '#1e1e3a',
  nodeBorder: '#2a2a50',
  nodeBorderSelected: '#5352ed',
  nodeBorderHover: '#706fe8',
  nodeTitleBarHeight: 28,

  /** Node category colors (bg, border) */
  categories: {
    geometry_input: { bg: '#1e3a5f', border: '#339af0' },
    geometry_op: { bg: '#3a3a1e', border: '#fcc419' },
    scene_output: { bg: '#1e3a2e', border: '#51cf66' },
    param_input: { bg: '#1e3a3a', border: '#22b8cf' },
    logic: { bg: '#3a2a1e', border: '#ff922b' },
    animation: { bg: '#2e1e3a', border: '#845ef7' },
    display_panel: { bg: '#1e3a3a', border: '#20c997' },
    material: { bg: '#3a1e3a', border: '#e64980' },
    physics: { bg: '#3a1e1e', border: '#ff6b6b' },
    particle: { bg: '#1e2e3a', border: '#74c0fc' },
    general: { bg: '#2a2a3a', border: '#748ffc' }
  },

  /** Slots */
  slotDefaultFill: '#5352ed',
  slotHoverFill: '#706fe8',
  slotConnectedFill: '#51cf66',
  slotInputStroke: '#339af0',
  slotOutputStroke: '#fcc419',

  /** Connection wires */
  wireDefault: '#5352ed',
  wireHover: '#706fe8',
  wireSelected: '#51cf66',
  wireOpacity: 0.7,

  /** Text */
  textPrimary: '#e8e8f0',
  textSecondary: '#8888a8',
  textTitle: '#ffffff',
  textSlot: '#ccccdd',

  /** Misc */
  selectionBox: 'rgba(83, 82, 237, 0.15)',
  selectionBoxBorder: 'rgba(83, 82, 237, 0.5)',
  dragIndicator: 'rgba(255, 255, 255, 0.1)',
  contextMenuBg: '#1a1a30',
  contextMenuBorder: '#2a2a50',
  contextMenuHover: '#2a2a50'
}

export const NODE_GRAPH_SIZES = {
  /** Node dimensions */
  nodeMinWidth: 160,
  nodeMaxWidth: 280,
  nodePaddingX: 12,
  nodePaddingY: 8,
  slotSpacingY: 22,
  slotRadius: 6,
  slotHitRadius: 10,

  /** Connection */
  wireWidth: 2,
  wireBezierOffset: 80,

  /** Grid */
  gridSmallSpacing: 20,
  gridLargeSpacing: 100,

  /** Minimap */
  minimapWidth: 180,
  minimapHeight: 120,
  minimapMargin: 10,

  /** Scrolling/zooming */
  minZoom: 0.1,
  maxZoom: 3.0,
  zoomStep: 0.1,
  panSpeed: 1.0,

  /** Snap */
  snapToGrid: true,
  snapGridSize: 20
}

export const NODE_GRAPH_FONTS = {
  title: {
    family: 'Inter, system-ui, sans-serif',
    size: 12,
    weight: '600',
    color: NODE_GRAPH_COLORS.textTitle
  },
  slot: {
    family: 'Inter, system-ui, sans-serif',
    size: 11,
    weight: '400',
    color: NODE_GRAPH_COLORS.textSlot
  },
  property: {
    family: 'Inter, system-ui, sans-serif',
    size: 10,
    weight: '400',
    color: NODE_GRAPH_COLORS.textSecondary
  },
  badge: {
    family: 'Inter, system-ui, sans-serif',
    size: 9,
    weight: '600',
    color: NODE_GRAPH_COLORS.textPrimary
  }
}

export const NODE_GRAPH_CONSTANTS = {
  ...NODE_GRAPH_COLORS,
  ...NODE_GRAPH_SIZES,
  ...NODE_GRAPH_FONTS
}