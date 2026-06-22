/**
 * 场景数据 Store
 * 纯数据层，管理场景中物体的数据模型
 * Three.js 渲染逻辑在 core/scene/SceneManager.js
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SCENE_EVENTS } from '../core/eventBus.js'
import emitter from '../core/eventBus.js'

export const useSceneStore = defineStore('scene', () => {
  const objects = ref([])
  const nextObjectId = ref(1)

  const objectCount = computed(() => objects.value.length)

  function addObject(objData) {
    const id = `obj_${nextObjectId.value++}`
    const newObj = {
      id,
      name: objData.name || `Object ${objects.value.length + 1}`,
      type: objData.type || 'mesh',         // mesh | light | display_panel | empty
      visible: true,
      locked: false,
      position: objData.position || { x: 0, y: 0, z: 0 },
      rotation: objData.rotation || { x: 0, y: 0, z: 0 },
      scale: objData.scale || { x: 1, y: 1, z: 1 },
      materialId: objData.materialId || null,
      material: objData.material || { color: '#5352ed', metalness: 0.3, roughness: 0.4 },
      physicsEnabled: false,
      animatable: true,
      nodeId: objData.nodeId || null,
      metadata: objData.metadata || {}
    }
    objects.value.push(newObj)
    emitter.emit(SCENE_EVENTS.OBJECT_ADDED, newObj)
    emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
    return newObj
  }

  function addObjectWithId(id, objData) {
    const newObj = {
      id,
      name: objData.name || `Object ${objects.value.length + 1}`,
      type: objData.type || 'mesh',
      visible: true, locked: false,
      position: objData.position || { x: 0, y: 0, z: 0 },
      rotation: objData.rotation || { x: 0, y: 0, z: 0 },
      scale: objData.scale || { x: 1, y: 1, z: 1 },
      materialId: objData.materialId || null,
      material: objData.material || { color: '#5352ed', metalness: 0.3, roughness: 0.4 },
      physicsEnabled: false, animatable: true,
      nodeId: objData.nodeId || null,
      metadata: objData.metadata || {}
    }
    objects.value.push(newObj)
    emitter.emit(SCENE_EVENTS.OBJECT_ADDED, newObj)
    emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
    return newObj
  }

  function removeObject(id) {
    const idx = objects.value.findIndex(o => o.id === id)
    if (idx !== -1) {
      const obj = objects.value.splice(idx, 1)[0]
      emitter.emit(SCENE_EVENTS.OBJECT_REMOVED, obj)
      emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
      return obj
    }
    return null
  }

  function updateObject(id, updates) {
    const obj = objects.value.find(o => o.id === id)
    if (obj) {
      Object.assign(obj, updates)
      emitter.emit(SCENE_EVENTS.OBJECT_CHANGED, obj)
      emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
    }
  }

  function toggleVisibility(id) {
    const obj = objects.value.find(o => o.id === id)
    if (obj) {
      obj.visible = !obj.visible
      emitter.emit(SCENE_EVENTS.OBJECT_VISIBILITY_CHANGED, { id, visible: obj.visible })
      emitter.emit(SCENE_EVENTS.OBJECT_CHANGED, obj)
      emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
    }
  }

  function toggleLock(id) {
    const obj = objects.value.find(o => o.id === id)
    if (obj) obj.locked = !obj.locked
  }

  function getObjectsByType(type) {
    return objects.value.filter(o => o.type === type)
  }

  function clearScene() {
    objects.value = []
    nextObjectId.value = 1
    emitter.emit(SCENE_EVENTS.SCENE_CLEARED)
    emitter.emit(SCENE_EVENTS.SCENE_UPDATED)
  }

  return {
    objects, objectCount,
    addObject, addObjectWithId, removeObject, updateObject,
    toggleVisibility, toggleLock, getObjectsByType, clearScene
  }
})
