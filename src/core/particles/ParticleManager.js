/**
 * 粒子系统管理 - ParticleManager
 * 管理 Babylon.js ParticleSystem / GPUParticleSystem 实例
 */
import { Vector3, Color3, Texture } from '@babylonjs/core'
import { ParticleSystem } from '@babylonjs/core/Particles'
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem'
import emitter, { PARTICLE_EVENTS, SCENE_EVENTS } from '../eventBus.js'
import sceneManager from '../scene/SceneManager.js'

class ParticleManager {
  constructor() {
    this._systems = new Map()
    this._scene = null
    this._initialized = false
    this._nextId = 1
  }

  init(scene) {
    if (this._initialized) return
    this._scene = scene || sceneManager.scene
    if (!this._scene) {
      console.warn('[ParticleManager] No scene available.')
      return
    }
    this._initialized = true
    console.log('[ParticleManager] Initialized.')
  }

  createSystem(config = {}) {
    if (!this._initialized) {
      console.warn('[ParticleManager] Not initialized.')
      return null
    }

    const id = config.id || `ps_${this._nextId++}`
    const useGPU = config.gpu || false
    const capacity = config.capacity || 2000

    let system
    if (useGPU) {
      system = new GPUParticleSystem(id, { capacity }, this._scene)
    } else {
      system = new ParticleSystem(id, capacity, this._scene)
    }

    // Common config
    system.emitter = config.emitter || Vector3.Zero()
    if (config.direction1) system.direction1 = new Vector3(config.direction1.x, config.direction1.y, config.direction1.z)
    if (config.direction2) system.direction2 = new Vector3(config.direction2.x, config.direction2.y, config.direction2.z)
    if (config.minEmitBox) system.minEmitBox = new Vector3(config.minEmitBox.x, config.minEmitBox.y, config.minEmitBox.z)
    if (config.maxEmitBox) system.maxEmitBox = new Vector3(config.maxEmitBox.x, config.maxEmitBox.y, config.maxEmitBox.z)

    system.color1 = config.color1 ? new Color3(config.color1.r, config.color1.g, config.color1.b) : new Color3(1, 1, 1)
    system.color2 = config.color2 ? new Color3(config.color2.r, config.color2.g, config.color2.b) : new Color3(1, 0.8, 0.5)
    system.colorDead = config.colorDead ? new Color3(config.colorDead.r, config.colorDead.g, config.colorDead.b) : new Color3(0, 0, 0)

    system.minSize = config.minSize !== undefined ? config.minSize : 0.1
    system.maxSize = config.maxSize !== undefined ? config.maxSize : 0.5
    system.minLifeTime = config.minLifeTime !== undefined ? config.minLifeTime : 0.3
    system.maxLifeTime = config.maxLifeTime !== undefined ? config.maxLifeTime : 1.5
    system.emitRate = config.emitRate !== undefined ? config.emitRate : 100
    system.blendMode = config.blendMode !== undefined ? config.blendMode : ParticleSystem.BLENDMODE_ONEONE
    system.gravity = config.gravity ? new Vector3(config.gravity.x, config.gravity.y, config.gravity.z) : new Vector3(0, -9.81, 0)
    system.minAngularSpeed = config.minAngularSpeed !== undefined ? config.minAngularSpeed : 0
    system.maxAngularSpeed = config.maxAngularSpeed !== undefined ? config.maxAngularSpeed : Math.PI
    system.minEmitPower = config.minEmitPower !== undefined ? config.minEmitPower : 1
    system.maxEmitPower = config.maxEmitPower !== undefined ? config.maxEmitPower : 3
    system.updateSpeed = config.updateSpeed !== undefined ? config.updateSpeed : 0.01

    if (config.textureUrl) {
      system.particleTexture = new Texture(config.textureUrl, this._scene)
    }

    system.start()
    this._systems.set(id, { system, config })

    emitter.emit(PARTICLE_EVENTS.PARTICLE_SYSTEM_ADDED, { id, config })
    return id
  }

  updateSystem(id, params) {
    const entry = this._systems.get(id)
    if (!entry) return

    const sys = entry.system
    if (params.emitRate !== undefined) sys.emitRate = params.emitRate
    if (params.minSize !== undefined) sys.minSize = params.minSize
    if (params.maxSize !== undefined) sys.maxSize = params.maxSize
    if (params.minLifeTime !== undefined) sys.minLifeTime = params.minLifeTime
    if (params.maxLifeTime !== undefined) sys.maxLifeTime = params.maxLifeTime
    if (params.minEmitPower !== undefined) sys.minEmitPower = params.minEmitPower
    if (params.maxEmitPower !== undefined) sys.maxEmitPower = params.maxEmitPower
    if (params.gravity) sys.gravity = new Vector3(params.gravity.x, params.gravity.y, params.gravity.z)
    if (params.color1) sys.color1 = new Color3(params.color1.r, params.color1.g, params.color1.b)
    if (params.color2) sys.color2 = new Color3(params.color2.r, params.color2.g, params.color2.b)
    if (params.colorDead) sys.colorDead = new Color3(params.colorDead.r, params.colorDead.g, params.colorDead.b)

    entry.config = { ...entry.config, ...params }
  }

  removeSystem(id) {
    const entry = this._systems.get(id)
    if (!entry) return
    entry.system.stop()
    entry.system.dispose()
    this._systems.delete(id)
    emitter.emit(PARTICLE_EVENTS.PARTICLE_SYSTEM_REMOVED, { id })
  }

  getSystem(id) {
    const entry = this._systems.get(id)
    return entry ? entry.system : null
  }

  /** Preset: Fire */
  createFire(x = 0, y = 0, z = 0) {
    return this.createSystem({
      id: `fire_${Date.now()}`,
      emitter: new Vector3(x, y, z),
      direction1: new Vector3(-0.3, 2, -0.3),
      direction2: new Vector3(0.3, 3, 0.3),
      color1: new Color3(1, 0.6, 0.1),
      color2: new Color3(1, 0.2, 0),
      colorDead: new Color3(0.1, 0, 0),
      minEmitPower: 1,
      maxEmitPower: 3,
      emitRate: 200,
      minLifeTime: 0.2,
      maxLifeTime: 0.8,
      minSize: 0.1,
      maxSize: 0.6,
      blendMode: ParticleSystem.BLENDMODE_ADD,
      gravity: new Vector3(0, -2, 0)
    })
  }

  /** Preset: Smoke */
  createSmoke(x = 0, y = 0, z = 0) {
    return this.createSystem({
      id: `smoke_${Date.now()}`,
      emitter: new Vector3(x, y, z),
      direction1: new Vector3(-0.5, 1, -0.5),
      direction2: new Vector3(0.5, 2, 0.5),
      color1: new Color3(0.5, 0.5, 0.5),
      color2: new Color3(0.3, 0.3, 0.3),
      colorDead: new Color3(0, 0, 0),
      minEmitPower: 0.5,
      maxEmitPower: 1.5,
      emitRate: 50,
      minLifeTime: 1.0,
      maxLifeTime: 3.0,
      minSize: 0.3,
      maxSize: 1.0,
      blendMode: ParticleSystem.BLENDMODE_STANDARD,
      gravity: new Vector3(0, 0.5, 0)
    })
  }

  /** Preset: Sparkle */
  createSparkle(x = 0, y = 0, z = 0) {
    return this.createSystem({
      id: `sparkle_${Date.now()}`,
      emitter: new Vector3(x, y, z),
      direction1: new Vector3(-1, -1, -1),
      direction2: new Vector3(1, 1, 1),
      color1: new Color3(1, 1, 1),
      color2: new Color3(0.8, 0.9, 1),
      colorDead: new Color3(0.2, 0.3, 0.5),
      minEmitPower: 0.5,
      maxEmitPower: 2,
      emitRate: 100,
      minLifeTime: 0.3,
      maxLifeTime: 1.0,
      minSize: 0.02,
      maxSize: 0.08,
      blendMode: ParticleSystem.BLENDMODE_ADD,
      gravity: new Vector3(0, -1, 0)
    })
  }

  get systemCount() { return this._systems.size }

  destroy() {
    for (const [id] of this._systems) {
      this.removeSystem(id)
    }
    this._systems.clear()
    this._scene = null
    this._initialized = false
  }
}

const particleManager = new ParticleManager()
export default particleManager
export { ParticleManager }