/**
 * 编辑器交互系统 - ViewportEditor (Babylon.js)
 * 管理 3D 视口交互：轨道控制、选择拾取、Gizmo 变换、鼠标交互
 * Babylon.js 的 ArcRotateCamera 内置轨道控制，GizmoManager 内置变换 Gizmo
 */
import { Vector3, Space } from '@babylonjs/core'
import emitter, { VIEWPORT_EVENTS, SELECTION_EVENTS, MODE_EVENTS } from '../eventBus.js'
import sceneManager from '../scene/SceneManager.js'

class ViewportEditor {
  constructor() {
    this._initialized = false
    this._canvasEl = null
    this._containerEl = null
    this._attachedMesh = null
  }

  async init() {
    // 延迟初始化，需要 DOM 容器
  }

  /** 在 DOM 容器就绪后调用 */
  initWithContainer(containerEl, canvasEl) {
    this._containerEl = containerEl
    this._canvasEl = canvasEl
    this._initialized = true
  }

  /** 执行射线拾取，返回 [{ objectId, point, distance, faceId, subMeshFaceId }] */
  raycast(screenX, screenY, meshes) {
    const scene = sceneManager.scene
    if (!scene || !this._canvasEl) return []

    const rect = this._canvasEl.getBoundingClientRect()
    // Babylon.js scene.pick 需要 canvas 相对像素坐标，非归一化坐标
    const x = screenX - rect.left
    const y = screenY - rect.top

    // Babylon.js 使用 scene.pick 进行射线拾取
    const pickResult = scene.pick(x, y, (mesh) => {
      // 只拾取用户对象 mesh
      if (mesh.metadata?.isHelper) return false
      if (meshes && meshes.length > 0) {
        return meshes.includes(mesh)
      }
      return true
    })

    if (pickResult.hit && pickResult.pickedMesh) {
      return [{
        objectId: pickResult.pickedMesh.metadata?.objectId || null,
        object: pickResult.pickedMesh,
        point: pickResult.pickedPoint,
        distance: pickResult.distance,
        faceId: pickResult.faceId ?? -1,
        subMeshFaceId: pickResult.subMeshFaceId ?? -1,
        bu: pickResult.bu,
        bv: pickResult.bv
      }]
    }
    return []
  }

  /** 将 Gizmo 附加到 Babylon.js Mesh */
  attachTransform(mesh) {
    if (sceneManager.gizmoManager && mesh) {
      this._attachedMesh = mesh
      sceneManager.gizmoManager.attachToMesh(mesh)
    }
  }

  /** 分离 Gizmo */
  detachTransform() {
    if (sceneManager.gizmoManager) {
      sceneManager.gizmoManager.attachToMesh(null)
      this._attachedMesh = null
    }
  }

  /** 设置变换模式：translate / rotate / scale */
  setTransformMode(mode) {
    const gm = sceneManager.gizmoManager
    if (!gm) return
    // 先关闭所有
    gm.positionGizmoEnabled = false
    gm.rotationGizmoEnabled = false
    gm.scaleGizmoEnabled = false
    // 按模式启用
    switch (mode) {
      case 'translate':
        gm.positionGizmoEnabled = true
        break
      case 'rotate':
        gm.rotationGizmoEnabled = true
        break
      case 'scale':
        gm.scaleGizmoEnabled = true
        break
    }
  }

  /** 设置变换空间：local / world */
  setTransformSpace(space) {
    const gm = sceneManager.gizmoManager
    if (!gm) return
    // Babylon.js Gizmo 通过 gizmo.space 设置
    const babylonSpace = space === 'local' ? Space.LOCAL : Space.WORLD
    if (gm.positionGizmo) gm.positionGizmo.space = babylonSpace
    if (gm.rotationGizmo) gm.rotationGizmo.space = babylonSpace
    if (gm.scaleGizmo) gm.scaleGizmo.space = babylonSpace
  }

  /** 预览模式：禁用/启用编辑交互 */
  setEditable(editable) {
    if (!sceneManager.camera) return
    if (editable) {
      sceneManager.camera.attachControl(this._canvasEl, true)
    } else {
      this.detachTransform()
      // 保持相机控制（预览时允许观察）
      sceneManager.camera.attachControl(this._canvasEl, true)
    }
  }

  /** 获取当前相机信息 */
  getCameraInfo() {
    if (!sceneManager.camera) return null
    return {
      position: sceneManager.camera.position.clone(),
      target: sceneManager.camera.target.clone(),
      isPerspective: sceneManager.isPerspective
    }
  }

  /** 获取当前附加的 mesh */
  get attachedMesh() {
    return this._attachedMesh
  }

  destroy() {
    this.detachTransform()
    this._canvasEl = null
    this._containerEl = null
    this._initialized = false
  }
}

const viewportEditor = new ViewportEditor()
export default viewportEditor
export { ViewportEditor }
