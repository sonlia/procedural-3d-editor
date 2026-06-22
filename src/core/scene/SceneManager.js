/**
 * 场景管理系统 - SceneManager (Babylon.js)
 * 管理 Babylon.js Engine, Scene, Camera, Lights, Gizmos, Grid
 * 独立于编辑交互，仅负责 3D 场景的创建与渲染
 */
import {
  Engine, Scene, ArcRotateCamera, FreeCamera, Camera,
  HemisphericLight, DirectionalLight, PointLight, SpotLight,
  Color3, Color4, Vector3,
  ShadowGenerator,
  GizmoManager, Space,
  HighlightLayer,
  MeshBuilder,
  PBRMetallicRoughnessMaterial, PBRMaterial, StandardMaterial
} from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import emitter, { VIEWPORT_EVENTS, SCENE_EVENTS, KERNEL_EVENTS } from '../eventBus.js'

class SceneManager {
  constructor() {
    this.engine = null
    this.scene = null
    this.camera = null
    this.gizmoManager = null
    this._gridMesh = null
    this._axesMesh = null
    this._container = null
    this._canvasEl = null
    this._renderCallbacks = []
    this.isPerspective = true
    this._lastTime = performance.now()
    this._resizeObserver = null
    // 环境参数（可由环境面板调节）
    this.environment = {
      bgColor: { r: 0.1, g: 0.1, b: 0.18 },
      ambientIntensity: 0.6,
      ambientColor: { r: 0.4, g: 0.4, b: 0.6 },
      dirLightIntensity: 1.2,
      dirLightColor: { r: 1, g: 1, b: 1 },
      dirLightPosition: { x: 5, y: 8, z: 5 },
      fillLightIntensity: 0.4,
      fillLightColor: { r: 0.3, g: 0.4, b: 0.7 },
      fillLightPosition: { x: -3, y: 4, z: -3 },
      shadowEnabled: true,
      toneMappingExposure: 1.2,
      fogEnabled: true,
      fogDensity: 0.01,
      fogColor: { r: 0.1, g: 0.1, b: 0.18 }
    }
    // 引用场景灯光（供环境面板操控）
    this._ambientLight = null
    this._dirLight = null
    this._fillLight = null
    this._shadowGenerator = null
  }

  async init() {
    console.log('[SceneManager] init (deferred - needs container)')
  }

  /** 在 DOM 容器就绪后调用 */
  initWithContainer(container, canvasEl) {
    this._container = container
    this._canvasEl = canvasEl
    const w = container.clientWidth
    const h = container.clientHeight

    // Engine
    this.engine = new Engine(canvasEl, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    })
    this.engine.setSize(w, h)

    // Scene
    this.scene = new Scene(this.engine)
    const env = this.environment
    this.scene.clearColor = new Color4(env.bgColor.r, env.bgColor.g, env.bgColor.b, 1)
    this.scene.ambientColor = new Color3(env.ambientColor.r * 0.3, env.ambientColor.g * 0.3, env.ambientColor.b * 0.3)

    // Fog
    if (env.fogEnabled) {
      this.scene.fogMode = Scene.FOGMODE_EXP2
      this.scene.fogDensity = env.fogDensity
      this.scene.fogColor = new Color3(env.fogColor.r, env.fogColor.g, env.fogColor.b)
    }

    // Camera: ArcRotateCamera (内置轨道控制)
    this.camera = new ArcRotateCamera(
      'mainCamera',
      Math.PI / 4,       // alpha (水平旋转角)
      Math.PI / 3,       // beta (垂直旋转角)
      10,                // radius
      Vector3.Zero(),     // target
      this.scene
    )
    this.camera.attachControl(canvasEl, true)
    this.camera.minZ = 0.1
    this.camera.maxZ = 1000
    this.camera.lowerRadiusLimit = 1
    this.camera.upperRadiusLimit = 100
    this.camera.wheelDeltaPercentage = 0.01
    this.camera.panningSensibility = 100
    this.camera.maxZ = 1000
    // 限制垂直角度，防止翻转
    this.camera.lowerBetaLimit = 0.1
    this.camera.upperBetaLimit = Math.PI * 0.95

    // 灯光
    this._setupDefaultLights()

    // 网格地面
    this._createGrid()

    // 坐标轴
    this._createAxes()

    // GizmoManager: Babylon.js 内置 Gizmo 系统
    this.gizmoManager = new GizmoManager(this.scene)
    this.gizmoManager.positionGizmoEnabled = false
    this.gizmoManager.rotationGizmoEnabled = false
    this.gizmoManager.scaleGizmoEnabled = false
    this.gizmoManager.usePointerToAttachGizmos = false
    // 默认不启用 boundingBox（避免干扰）
    this.gizmoManager.boundingBoxGizmoEnabled = false

    // Highlight layer for selection/hover feedback
    this._highlightLayer = new HighlightLayer('hl', this.scene)

    // Render loop
    this._lastTime = performance.now()
    this.engine.runRenderLoop(() => {
      const now = performance.now()
      const delta = (now - this._lastTime) / 1000
      this._lastTime = now
      for (const cb of this._renderCallbacks) cb(delta)
      this.scene.render()
      emitter.emit(VIEWPORT_EVENTS.FRAME_READY)
    })

    // Resize
    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(container)

    emitter.emit(VIEWPORT_EVENTS.FRAME_READY, { scene: this.scene, camera: this.camera })
  }

  /** 创建/更新网格地面 */
  _createGrid() {
    if (this._gridMesh) {
      this._gridMesh.dispose()
    }
    const gridSize = 20
    const gridMat = new GridMaterial('gridMat', this.scene)
    gridMat.majorUnitFrequency = 5
    gridMat.minorUnitVisibility = 0.3
    gridMat.gridRatio = 1
    gridMat.mainColor = new Color3(0.12, 0.12, 0.23)
    gridMat.lineColor = new Color3(0.16, 0.16, 0.29)
    gridMat.opacity = 0.98
    gridMat.backFaceCulling = false

    this._gridMesh = MeshBuilder.CreateGround('grid', {
      width: gridSize,
      height: gridSize,
      subdivisions: 1
    }, this.scene)
    this._gridMesh.material = gridMat
    this._gridMesh.position.y = 0
    this._gridMesh.isPickable = false
    this._gridMesh.metadata = { isHelper: true }
  }

  /** 创建坐标轴指示器 */
  _createAxes() {
    if (this._axesMesh) {
      this._axesMesh.forEach(l => l.dispose())
    }
    this._axesMesh = []
    const len = 3
    const axes = [
      { name: 'axisX', points: [Vector3.Zero(), new Vector3(len, 0, 0)], color: new Color3(1, 0.2, 0.2) },
      { name: 'axisY', points: [Vector3.Zero(), new Vector3(0, len, 0)], color: new Color3(0.2, 1, 0.2) },
      { name: 'axisZ', points: [Vector3.Zero(), new Vector3(0, 0, len)], color: new Color3(0.2, 0.2, 1) }
    ]
    for (const axis of axes) {
      const line = MeshBuilder.CreateLines(axis.name, {
        points: axis.points
      }, this.scene)
      line.color = axis.color
      line.alpha = 1
      line.isPickable = false
      line.metadata = { isHelper: true }
      this._axesMesh.push(line)
    }
  }

  /** 设置默认灯光 */
  _setupDefaultLights() {
    const env = this.environment

    // Hemisphere light (类似环境光)
    this._ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this.scene)
    this._ambientLight.intensity = env.ambientIntensity
    this._ambientLight.diffuse = new Color3(env.ambientColor.r, env.ambientColor.g, env.ambientColor.b)
    this._ambientLight.groundColor = new Color3(0.1, 0.1, 0.15)

    // Directional light (主光源 + 阴影)
    this._dirLight = new DirectionalLight('dirLight',
      new Vector3(env.dirLightPosition.x, env.dirLightPosition.y, env.dirLightPosition.z),
      this.scene
    )
    this._dirLight.intensity = env.dirLightIntensity
    this._dirLight.diffuse = new Color3(env.dirLightColor.r, env.dirLightColor.g, env.dirLightColor.b)

    // Shadow generator
    if (env.shadowEnabled) {
      this._shadowGenerator = new ShadowGenerator(2048, this._dirLight)
      this._shadowGenerator.useBlurExponentialShadowMap = true
      this._shadowGenerator.blurKernel = 32
    }

    // Fill light (补光)
    this._fillLight = new DirectionalLight('fillLight',
      new Vector3(env.fillLightPosition.x, env.fillLightPosition.y, env.fillLightPosition.z),
      this.scene
    )
    this._fillLight.intensity = env.fillLightIntensity
    this._fillLight.diffuse = new Color3(env.fillLightColor.r, env.fillLightColor.g, env.fillLightColor.b)
  }

  /** 切换透视/正交相机 */
  toggleProjection() {
    if (!this.camera) return
    // Babylon.js ArcRotateCamera 支持 mode 切换
    if (this.isPerspective) {
      // 切换到正交模式
      const ratio = this._container.clientWidth / this._container.clientHeight
      const halfSize = this.camera.radius * 0.5
      this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA
      this.camera.orthoTop = halfSize
      this.camera.orthoBottom = -halfSize
      this.camera.orthoLeft = -halfSize * ratio
      this.camera.orthoRight = halfSize * ratio
      this.isPerspective = false
    } else {
      this.camera.mode = Camera.PERSPECTIVE_CAMERA
      this.isPerspective = true
    }
    emitter.emit(VIEWPORT_EVENTS.VIEW_MODE_CHANGED, { isPerspective: this.isPerspective })
  }

  /** 设置视图预设 */
  setViewPreset(view) {
    if (!this.camera) return
    const radius = this.camera.radius || 10
    switch (view) {
      case 'top':
        this.camera.alpha = 0
        this.camera.beta = 0.01
        break
      case 'front':
        this.camera.alpha = Math.PI / 2
        this.camera.beta = Math.PI / 2
        break
      case 'right':
        this.camera.alpha = 0
        this.camera.beta = Math.PI / 2
        break
      case 'perspective':
        this.camera.alpha = Math.PI / 4
        this.camera.beta = Math.PI / 3
        break
    }
    emitter.emit(VIEWPORT_EVENTS.CAMERA_CHANGED, { view })
  }

  /** 注册每帧渲染前的回调 */
  onBeforeRender(callback) {
    this._renderCallbacks.push(callback)
    return () => {
      const idx = this._renderCallbacks.indexOf(callback)
      if (idx !== -1) this._renderCallbacks.splice(idx, 1)
    }
  }

  /** 获取当前视口尺寸 */
  getSize() {
    if (!this._container) return { width: 0, height: 0 }
    return {
      width: this._container.clientWidth,
      height: this._container.clientHeight
    }
  }

  /** 获取/设置网格可见性 */
  setGridVisible(visible) {
    if (this._gridMesh) this._gridMesh.isVisible = visible
  }
  get gridVisible() {
    return this._gridMesh ? this._gridMesh.isVisible : true
  }

  /** 更新环境参数（由环境编辑面板调用） */
  updateEnvironment(params) {
    Object.assign(this.environment, params)
    const env = this.environment

    // 背景
    this.scene.clearColor = new Color4(env.bgColor.r, env.bgColor.g, env.bgColor.b, 1)

    // 环境光
    if (this._ambientLight) {
      this._ambientLight.intensity = env.ambientIntensity
      this._ambientLight.diffuse = new Color3(env.ambientColor.r, env.ambientColor.g, env.ambientColor.b)
    }

    // 主方向光
    if (this._dirLight) {
      this._dirLight.intensity = env.dirLightIntensity
      this._dirLight.diffuse = new Color3(env.dirLightColor.r, env.dirLightColor.g, env.dirLightColor.b)
      this._dirLight.position = new Vector3(env.dirLightPosition.x, env.dirLightPosition.y, env.dirLightPosition.z)
    }

    // 补光
    if (this._fillLight) {
      this._fillLight.intensity = env.fillLightIntensity
      this._fillLight.diffuse = new Color3(env.fillLightColor.r, env.fillLightColor.g, env.fillLightColor.b)
      this._fillLight.position = new Vector3(env.fillLightPosition.x, env.fillLightPosition.y, env.fillLightPosition.z)
    }

    // 阴影
    if (this._shadowGenerator) {
      this._shadowGenerator.getShadowMap().renderList.forEach(m => {
        if (env.shadowEnabled) {
          this._shadowGenerator.addShadowCaster(m)
        }
      })
    }

    // 雾
    if (env.fogEnabled) {
      this.scene.fogMode = Scene.FOGMODE_EXP2
      this.scene.fogDensity = env.fogDensity
      this.scene.fogColor = new Color3(env.fogColor.r, env.fogColor.g, env.fogColor.b)
    } else {
      this.scene.fogMode = Scene.FOGMODE_NONE
    }
  }

  /** 设置场景中所有 mesh 的 wireframe 模式 */
  setWireframeMode(enabled) {
    this.scene.meshes.forEach(m => {
      if (m.material && !m.metadata?.isHelper) {
        if (m.material.wireframe !== undefined) {
          m.material.wireframe = enabled
        }
      }
    })
  }

  _onResize() {
    if (!this._container || !this.engine) return
    this.engine.resize()
    emitter.emit(VIEWPORT_EVENTS.VIEW_RESIZED, {
      width: this._container.clientWidth,
      height: this._container.clientHeight
    })
  }

  /** Activate gizmo for a specific mode */
  activateGizmo(mode, mesh) {
    if (!this.gizmoManager || !mesh) return
    this.gizmoManager.attachToMesh(mesh)
    this.gizmoManager.positionGizmoEnabled = mode === 'translate'
    this.gizmoManager.rotationGizmoEnabled = mode === 'rotate'
    this.gizmoManager.scaleGizmoEnabled = mode === 'scale'
  }

  /** Get highlight layer */
  get highlightLayer() { return this._highlightLayer }

  destroy() {
    if (this._resizeObserver) this._resizeObserver.disconnect()
    if (this._highlightLayer) {
      this._highlightLayer.dispose()
      this._highlightLayer = null
    }
    if (this.gizmoManager) {
      this.gizmoManager.dispose()
      this.gizmoManager = null
    }
    if (this.scene) {
      this.scene.dispose()
    }
    if (this.engine) {
      this.engine.dispose()
    }
    this._renderCallbacks = []
    this._highlightLayer = null
    this.scene = null
    this.camera = null
    this.engine = null
  }
}

// 全局单例
const sceneManager = new SceneManager()
export default sceneManager
export { SceneManager }
