/**
 * Procedural3D Editor - 事件总线模块
 * 按功能系统分组的事件类型定义，建立清晰的模块间通信协议
 */
import mitt from 'mitt'

const emitter = mitt()

// ========================================
// 模块事件分组
// ========================================

/** 场景系统事件 - SceneManager ↔ 所有模块 */
export const SCENE_EVENTS = {
  OBJECT_ADDED: 'scene:object:added',
  OBJECT_REMOVED: 'scene:object:removed',
  OBJECT_CHANGED: 'scene:object:changed',
  OBJECT_VISIBILITY_CHANGED: 'scene:object:visibility',
  SCENE_UPDATED: 'scene:updated',
  SCENE_CLEARED: 'scene:cleared'
}

/** 编辑器选择系统事件 - SelectionManager ↔ 视口/面板 */
export const SELECTION_EVENTS = {
  OBJECT_SELECTED: 'selection:object:selected',
  OBJECT_DESELECTED: 'selection:object:deselected',
  VERTEX_SELECTED: 'selection:vertex:selected',
  EDGE_SELECTED: 'selection:edge:selected',
  FACE_SELECTED: 'selection:face:selected',
  SELECTION_CHANGED: 'selection:changed',
  SELECTION_CLEARED: 'selection:cleared',
  HOVER_CHANGED: 'selection:hover:changed'
}

/** 编辑模式事件 - EditorMode ↔ 视口/工具栏/面板 */
export const MODE_EVENTS = {
  EDIT_MODE_CHANGED: 'mode:edit:changed',
  TRANSFORM_MODE_CHANGED: 'mode:transform:changed',
  TRANSFORM_SPACE_CHANGED: 'mode:space:changed',
  APP_MODE_CHANGED: 'mode:app:changed'        // design → preview → publish
}

/** 3D 视口事件 - Viewport3D ↔ 相机/渲染 */
export const VIEWPORT_EVENTS = {
  VIEW_RESIZED: 'viewport:resized',
  VIEW_MODE_CHANGED: 'viewport:view:changed',   // perspective / ortho
  CAMERA_CHANGED: 'viewport:camera:changed',
  FRAME_READY: 'viewport:frame:ready'
}

/** 节点引擎事件 - NodeEngine ↔ 节点编辑器/视口 */
export const NODE_EVENTS = {
  NODE_SELECTED: 'node:selected',
  NODE_DESELECTED: 'node:deselected',
  NODE_ADDED: 'node:added',
  NODE_REMOVED: 'node:removed',
  NODE_PROPERTY_CHANGED: 'node:property:changed',
  NODE_GRAPH_CHANGED: 'node:graph:changed',
  NODE_EXECUTED: 'node:executed',
  NODE_GRAPH_DIRTY: 'node:graph:dirty',
  NODE_COLLAPSED: 'node:collapsed',
  NODE_COMBINED: 'node:combined'
}

/** 材质系统事件 - MaterialSystem ↔ 节点引擎/视口 */
export const MATERIAL_EVENTS = {
  MATERIAL_UPDATED: 'material:updated',
  MATERIAL_ASSIGNED: 'material:assigned',
  MATERIAL_COMPILED: 'material:compiled',
  MATERIAL_PREVIEW_CHANGED: 'material:preview:changed'
}

/** 动画系统事件 - AnimationSystem ↔ 时间轴/节点引擎/视口 */
export const ANIMATION_EVENTS = {
  TIMELINE_FRAME_CHANGED: 'animation:frame:changed',
  TIMELINE_PLAY_STATE_CHANGED: 'animation:play:changed',
  KEYFRAME_ADDED: 'animation:keyframe:added',
  KEYFRAME_REMOVED: 'animation:keyframe:removed',
  KEYFRAME_UPDATED: 'animation:keyframe:updated',
  CURVE_UPDATED: 'animation:curve:updated',
  TRACK_ADDED: 'animation:track:added',
  TRACK_REMOVED: 'animation:track:removed'
}

/** 建模系统事件 - MeshEditing ↔ 视口/节点引擎 */
export const MESH_EVENTS = {
  MESH_CHANGED: 'mesh:changed',
  MESH_TOPOLOGY_CHANGED: 'mesh:topology:changed',
  MESH_BOOLEAN_PERFORMED: 'mesh:boolean:performed',
  MESH_COLLAPSED: 'mesh:collapsed',
  VERTEX_MODIFIED: 'mesh:vertex:modified',
  EDGE_MODIFIED: 'mesh:edge:modified',
  FACE_MODIFIED: 'mesh:face:modified',
  MODELING_TOOL_CHANGED: 'mesh:modeling:tool:changed'   // 建模工具切换通知
}

/** 物理系统事件 - PhysicsWorld ↔ 视口/节点引擎 */
export const PHYSICS_EVENTS = {
  PHYSICS_STEP: 'physics:step',
  PHYSICS_COLLISION_START: 'physics:collision:start',
  PHYSICS_COLLISION_END: 'physics:collision:end',
  PHYSICS_BODY_ADDED: 'physics:body:added',
  PHYSICS_BODY_REMOVED: 'physics:body:removed',
  PHYSICS_SYNC: 'physics:sync'
}

/** 粒子系统事件 - ParticleSystem ↔ 节点引擎 */
export const PARTICLE_EVENTS = {
  PARTICLE_SYSTEM_ADDED: 'particle:system:added',
  PARTICLE_SYSTEM_REMOVED: 'particle:system:removed',
  PARTICLE_EMIT_TRIGGER: 'particle:emit:trigger'
}

/** 展示面板系统事件 - DisplayPanel ↔ 视口/节点引擎 */
export const DISPLAY_PANEL_EVENTS = {
  PANEL_ADDED: 'panel:added',
  PANEL_REMOVED: 'panel:removed',
  PANEL_DATA_UPDATED: 'panel:data:updated',
  PANEL_BINDING_CHANGED: 'panel:binding:changed',
  PANEL_VISIBILITY_CHANGED: 'panel:visibility:changed',
  PANEL_BILLBOARD_CHANGED: 'panel:billboard:changed'
}

/** 命令系统事件 - UndoRedo ↔ 所有可逆操作 */
export const COMMAND_EVENTS = {
  COMMAND_EXECUTED: 'command:executed',
  UNDO_PERFORMED: 'command:undo',
  REDO_PERFORMED: 'command:redo',
  COMMAND_STACK_CHANGED: 'command:stack:changed'
}

/** 资源系统事件 - ResourceManager ↔ 导入导出 */
export const RESOURCE_EVENTS = {
  RESOURCE_LOADED: 'resource:loaded',
  RESOURCE_DISPOSED: 'resource:disposed',
  PROJECT_SAVED: 'resource:project:saved',
  PROJECT_LOADED: 'resource:project:loaded'
}

/** 内核事件 - Kernel ↔ 全局 */
export const KERNEL_EVENTS = {
  INITIALIZED: 'kernel:initialized',
  MODULE_REGISTERED: 'kernel:module:registered',
  PLUGIN_LOADED: 'kernel:plugin:loaded'
}

// 汇总导出所有事件常量（兼容旧代码）
export const EDITOR_EVENTS = {
  ...SCENE_EVENTS,
  ...SELECTION_EVENTS,
  ...MODE_EVENTS,
  ...VIEWPORT_EVENTS,
  ...NODE_EVENTS,
  ...MATERIAL_EVENTS,
  ...ANIMATION_EVENTS,
  ...MESH_EVENTS,
  ...PHYSICS_EVENTS,
  ...PARTICLE_EVENTS,
  ...DISPLAY_PANEL_EVENTS,
  ...COMMAND_EVENTS,
  ...RESOURCE_EVENTS,
  ...KERNEL_EVENTS
}

export default emitter
