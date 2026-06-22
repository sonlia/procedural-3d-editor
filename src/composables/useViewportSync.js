/**
 * useViewportSync - Babylon.js Mesh 同步 composable
 *
 * 职责：
 * - 维护 objectMeshes Map（objectId -> BABYLON.Mesh）
 * - syncObjects()：差异对比 sceneStore.objects 与 objectMeshes，增删网格
 * - createObjectMesh(objData)：通过 PrimitiveFactory 创建网格
 * - attachTransformToSelection()：将 GizmoManager 附加到首个选中网格
 * - watchTransformMode/Space/SelectionMode：响应编辑器状态变化
 */
import { watch, onUnmounted } from 'vue'
import { Vector3, Color3, PBRMetallicRoughnessMaterial, StandardMaterial } from '@babylonjs/core'
import { useSceneStore } from '../stores/sceneStore'
import { useEditorStore, EDIT_MODES, APP_MODES } from '../stores/editorStore'
import sceneManager from '../core/scene/SceneManager.js'
import viewportEditor from '../core/editing/ViewportEditor.js'
import selectionManager from '../core/editing/SelectionManager.js'
import PrimitiveFactory from '../core/mesh/PrimitiveFactory.js'

export function useViewportSync() {
  const sceneStore = useSceneStore()
  const editorStore = useEditorStore()

  /**
   * objectId -> BABYLON.Mesh 映射表
   */
  const objectMeshes = new Map()

  /**
   * 差异同步：对比 sceneStore.objects 与 objectMeshes
   */
  function syncObjects() {
    const scene = sceneManager.scene
    if (!scene) return

    // 创建新增对象的 Mesh
    for (const obj of sceneStore.objects) {
      if (!objectMeshes.has(obj.id)) {
        createObjectMesh(obj)
      }
    }

    // 移除已删除对象的 Mesh
    for (const [id, mesh] of objectMeshes) {
      if (!sceneStore.objects.find(o => o.id === id)) {
        mesh.dispose()
        objectMeshes.delete(id)
        if (viewportEditor.attachedMesh === mesh) {
          viewportEditor.detachTransform()
        }
      }
    }
  }

  /**
   * 为场景对象创建 Babylon.js Mesh
   * 注意：rotation 在 sceneStore 中存储为角度（度），Babylon.js 使用弧度
   */
  function createObjectMesh(objData) {
    const scene = sceneManager.scene
    if (!scene) return

    let mesh

    if (objData.type === 'display_panel') {
      mesh = PrimitiveFactory.createDisplayPanelMesh(`dp_${objData.id}`, scene)
    } else if (objData.type === 'light') {
      const lightType = objData.metadata?.lightType || 'point'
      mesh = PrimitiveFactory.createLightIndicator(lightType, `light_${objData.id}`, scene)
    } else {
      const primitiveType = objData.metadata?.primitiveType || 'box'
      mesh = PrimitiveFactory.createMesh(primitiveType, {}, `mesh_${objData.id}`)
    }

    if (!mesh) return

    // position 直接设置（单位一致）
    mesh.position.x = objData.position.x
    mesh.position.y = objData.position.y
    mesh.position.z = objData.position.z

    // rotation: sceneStore 存角度，Babylon.js 需弧度
    const DEG2RAD = Math.PI / 180
    mesh.rotation.x = objData.rotation.x * DEG2RAD
    mesh.rotation.y = objData.rotation.y * DEG2RAD
    mesh.rotation.z = objData.rotation.z * DEG2RAD

    // scale
    mesh.scaling.x = objData.scale.x
    mesh.scaling.y = objData.scale.y
    mesh.scaling.z = objData.scale.z

    mesh.isVisible = objData.visible
    mesh.metadata = mesh.metadata || {}
    mesh.metadata.objectId = objData.id

    // 从 store material 数据恢复材质属性（持久化支持）
    if (objData.material && mesh.material && mesh.material instanceof PBRMetallicRoughnessMaterial) {
      const m = objData.material
      const color = m.color || '#5352ed'
      const r = parseInt(color.slice(1, 3), 16) / 255
      const g = parseInt(color.slice(3, 5), 16) / 255
      const b = parseInt(color.slice(5, 7), 16) / 255
      mesh.material.baseColor = new Color3(r, g, b)
      mesh.material.metallic = m.metalness ?? 0.3
      mesh.material.roughness = m.roughness ?? 0.4
      mesh.material.alpha = m.opacity ?? 1
      if (m.transparent) {
        mesh.material.transparencyMode = PBRMetallicRoughnessMaterial.MATERIAL_ALPHABLEND
      }
      if (m.wireframe) {
        mesh.material.wireframe = true
      }
    }

    scene.addMesh(mesh)
    objectMeshes.set(objData.id, mesh)
  }

  /**
   * 将 Gizmo 附加到当前选中的第一个对象
   */
  function attachTransformToSelection() {
    const ids = selectionManager.state.selectedObjectIds
    if (ids.length === 0) {
      viewportEditor.detachTransform()
      return
    }
    const mesh = objectMeshes.get(ids[0])
    if (mesh) {
      viewportEditor.attachTransform(mesh)
    }
  }

  /**
   * 获取所有可见的 Mesh 数组（用于射线拾取）
   */
  function getVisibleMeshes() {
    return Array.from(objectMeshes.values()).filter(m => m.isVisible)
  }

  /**
   * 根据 objectId 获取对应的 Mesh
   */
  function getMeshById(id) {
    return objectMeshes.get(id)
  }

  // ---- 监听场景数据变化，自动同步 ----
  watch(
    () => sceneStore.objects,
    () => syncObjects(),
    { deep: true }
  )

  // ---- 监听选中变化，自动更新 Gizmo ----
  watch(
    () => selectionManager.state.selectedObjectIds,
    () => attachTransformToSelection(),
    { deep: true }
  )

  // ---- 监听变换模式变化 ----
  watch(
    () => editorStore.transformMode,
    (mode) => {
      const modeMap = { translate: 'translate', rotate: 'rotate', scale: 'scale' }
      viewportEditor.setTransformMode(modeMap[mode])
    }
  )

  // ---- 监听变换空间变化 ----
  watch(
    () => editorStore.transformSpace,
    (space) => {
      viewportEditor.setTransformSpace(space)
    }
  )

  // ---- 监听应用模式变化（设计/预览） ----
  watch(
    () => editorStore.appMode,
    (mode) => {
      viewportEditor.setEditable(mode === APP_MODES.DESIGN)
    }
  )

  // ---- 生命周期清理 ----
  onUnmounted(() => {
    objectMeshes.forEach((mesh) => {
      mesh.dispose()
    })
    objectMeshes.clear()
  })

  return {
    objectMeshes,
    syncObjects,
    createObjectMesh,
    attachTransformToSelection,
    getVisibleMeshes,
    getMeshById
  }
}
