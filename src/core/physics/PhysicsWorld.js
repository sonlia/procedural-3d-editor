/**
 * 物理系统 - PhysicsWorld
 * 基于 Babylon.js PhysicsImpostor + OIMO 引擎，支持降级模式
 */
import { Vector3, Ray } from '@babylonjs/core'
import { PhysicsImpostor } from '@babylonjs/core/Physics/physicsImpostor'
import { OimoJSPlugin } from '@babylonjs/core/Physics/Plugins/oimoJSPlugin'
import emitter, { PHYSICS_EVENTS, SCENE_EVENTS } from '../eventBus.js'
import sceneManager from '../scene/SceneManager.js'

class PhysicsWorld {
  constructor() {
    this._initialized = false
    this._degraded = false
    this._scene = null
    this._plugin = null
    this._bodies = new Map()
    this._gravity = new Vector3(0, -9.81, 0)
  }

  get initialized() { return this._initialized }
  get degraded() { return this._degraded }

  init(scene) {
    if (this._initialized) return

    // CRITICAL: Check if OIMO is available
    if (typeof OIMO === 'undefined') {
      console.warn('[PhysicsWorld] OIMO engine not available — running in degraded mode (no physics simulation).')
      this._degraded = true
      this._initialized = true
      return
    }

    this._scene = scene || sceneManager.scene
    if (!this._scene) {
      console.warn('[PhysicsWorld] No scene available.')
      this._degraded = true
      this._initialized = true
      return
    }

    try {
      this._plugin = new OimoJSPlugin()
      this._scene.enablePhysics(this._gravity, this._plugin)
      this._initialized = true
      console.log('[PhysicsWorld] Initialized with OIMO plugin.')
    } catch (err) {
      console.warn('[PhysicsWorld] Failed to init physics engine, falling back to degraded mode:', err.message)
      this._degraded = true
      this._initialized = true
    }
  }

  setGravity(x, y, z) {
    this._gravity.set(x, y, z)
    if (!this._degraded && this._scene && this._scene.getPhysicsEngine()) {
      this._scene.getPhysicsEngine().setGravity(new Vector3(x, y, z))
    }
  }

  addBody(mesh, type = PhysicsImpostor.BoxImpostor, options = {}) {
    if (this._degraded) {
      console.warn('[PhysicsWorld] Degraded mode — addBody() skipped.')
      return null
    }
    if (!this._initialized) {
      console.warn('[PhysicsWorld] Not initialized — addBody() skipped.')
      return null
    }

    try {
      const mass = options.mass !== undefined ? options.mass : 1
      const restitution = options.restitution !== undefined ? options.restitution : 0.3
      const friction = options.friction !== undefined ? options.friction : 0.5

      const impostor = new PhysicsImpostor(mesh, type, {
        mass,
        restitution,
        friction
      }, this._scene)

      this._bodies.set(mesh.uniqueId, { mesh, impostor, type })
      emitter.emit(PHYSICS_EVENTS.PHYSICS_BODY_ADDED, { meshId: mesh.uniqueId })
      return impostor
    } catch (err) {
      console.error('[PhysicsWorld] addBody failed:', err)
      return null
    }
  }

  removeBody(mesh) {
    const entry = this._bodies.get(mesh.uniqueId)
    if (!entry) return
    if (entry.impostor) {
      entry.impostor.dispose()
    }
    this._bodies.delete(mesh.uniqueId)
    emitter.emit(PHYSICS_EVENTS.PHYSICS_BODY_REMOVED, { meshId: mesh.uniqueId })
  }

  getBody(mesh) {
    const entry = this._bodies.get(mesh.uniqueId)
    return entry ? entry.impostor : null
  }

  step(delta) {
    if (this._degraded) return
    // Babylon.js physics engine handles stepping internally via scene.render()
    emitter.emit(PHYSICS_EVENTS.PHYSICS_STEP, { delta })
  }

  applyForce(mesh, force, contactPoint) {
    if (this._degraded) {
      console.warn('[PhysicsWorld] Degraded mode — applyForce() skipped.')
      return
    }
    const entry = this._bodies.get(mesh?.uniqueId)
    if (!entry?.impostor) return
    const f = force instanceof Vector3 ? force : new Vector3(force.x || 0, force.y || 0, force.z || 0)
    const cp = contactPoint instanceof Vector3 ? contactPoint : mesh.getAbsolutePosition()
    entry.impostor.applyForce(f, cp)
  }

  applyImpulse(mesh, impulse, contactPoint) {
    if (this._degraded) {
      console.warn('[PhysicsWorld] Degraded mode — applyImpulse() skipped.')
      return
    }
    const entry = this._bodies.get(mesh?.uniqueId)
    if (!entry?.impostor) return
    const imp = impulse instanceof Vector3 ? impulse : new Vector3(impulse.x || 0, impulse.y || 0, impulse.z || 0)
    const cp = contactPoint instanceof Vector3 ? contactPoint : mesh.getAbsolutePosition()
    entry.impostor.applyImpulse(imp, cp)
  }

  setLinearVelocity(mesh, vel) {
    if (this._degraded) return
    const entry = this._bodies.get(mesh?.uniqueId)
    if (!entry?.impostor) return
    const v = vel instanceof Vector3 ? vel : new Vector3(vel.x || 0, vel.y || 0, vel.z || 0)
    entry.impostor.setLinearVelocity(v)
  }

  setAngularVelocity(mesh, vel) {
    if (this._degraded) return
    const entry = this._bodies.get(mesh?.uniqueId)
    if (!entry?.impostor) return
    const v = vel instanceof Vector3 ? vel : new Vector3(vel.x || 0, vel.y || 0, vel.z || 0)
    entry.impostor.setAngularVelocity(v)
  }

  /**
   * Raycast — works even in degraded mode (uses Babylon.js scene.pick)
   */
  raycast(origin, direction, length = 100) {
    const scene = this._scene || sceneManager.scene
    if (!scene) return null

    const o = origin instanceof Vector3 ? origin : new Vector3(origin.x || 0, origin.y || 0, origin.z || 0)
    const d = direction instanceof Vector3 ? direction : new Vector3(direction.x || 0, direction.y || 0, direction.z || 0)
    const ray = new Ray(o, d.normalize(), length)

    const hit = scene.pickWithRay(ray, (mesh) => {
      return !mesh.metadata?.isHelper && this._bodies.has(mesh.uniqueId)
    })

    if (hit && hit.hit && hit.pickedMesh) {
      return {
        hit: true,
        mesh: hit.pickedMesh,
        point: hit.pickedPoint,
        distance: hit.distance,
        normal: hit.getNormal(true)
      }
    }
    return null
  }

  syncBodies() {
    if (this._degraded) return
    for (const [, entry] of this._bodies) {
      if (entry.mesh && entry.impostor) {
        // Physics body drives mesh transform
        entry.mesh.position.copyFrom(entry.impostor.getObjectPosition())
        entry.mesh.rotation.copyFrom(entry.impostor.getObjectRotationQuaternion().toEulerAngles())
      }
    }
    emitter.emit(PHYSICS_EVENTS.PHYSICS_SYNC)
  }

  destroy() {
    for (const [, entry] of this._bodies) {
      if (entry.impostor) entry.impostor.dispose()
    }
    this._bodies.clear()
    this._plugin = null
    this._scene = null
    this._initialized = false
    this._degraded = false
  }
}

const physicsWorld = new PhysicsWorld()
export default physicsWorld
export { PhysicsWorld }