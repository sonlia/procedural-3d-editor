/**
 * [DEPRECATED] 事件总线兼容层
 * 新代码请直接引用：import emitter, { EVENT_GROUP } from '../core/eventBus.js'
 * 此文件仅为兼容旧引用保留，将在后续迭代中移除
 */
export { default, EDITOR_EVENTS } from '../core/eventBus.js'
export {
  SCENE_EVENTS, SELECTION_EVENTS, MODE_EVENTS, VIEWPORT_EVENTS,
  NODE_EVENTS, MATERIAL_EVENTS, ANIMATION_EVENTS, MESH_EVENTS,
  PHYSICS_EVENTS, PARTICLE_EVENTS, DISPLAY_PANEL_EVENTS,
  COMMAND_EVENTS, RESOURCE_EVENTS, KERNEL_EVENTS
} from '../core/eventBus.js'
