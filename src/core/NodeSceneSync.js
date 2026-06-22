/**
 * Node Graph → Scene Synchronization
 * Evaluates the node graph and syncs results to the Babylon.js scene
 */
import { Color3, Vector3, Mesh } from '@babylonjs/core'
import emitter, { NODE_EVENTS, SCENE_EVENTS, PHYSICS_EVENTS, PARTICLE_EVENTS, MESH_EVENTS } from './eventBus.js'
import sceneManager from './scene/SceneManager.js'
import PrimitiveFactory from './mesh/PrimitiveFactory.js'
import nodeEngine from './nodes/engine/NodeEngine.js'
import physicsWorld from './physics/PhysicsWorld.js'
import particleManager from './particles/ParticleManager.js'
import { rebuildBabylonFromHE } from './mesh/mesh-utils.js'

class NodeSceneSync {
  constructor() {
    this._initialized = false
    this._geometryCache = new Map()
    this._sceneMeshes = new Map() // nodeId → Babylon mesh
    this._physicsBodies = new Map() // nodeId → impostor
    this._particleEmitters = new Map() // nodeId → particle system id
  }

  async init() {
    if (this._initialized) return

    // Only init particleManager here; physicsWorld init is handled by App.vue
    particleManager.init()

    this._initialized = true
    console.log('[NodeSceneSync] Initialized.')

    // Listen for node graph changes
    emitter.on(NODE_EVENTS.NODE_GRAPH_DIRTY, () => {
      // Will be picked up by evaluate loop
    })
  }

  /** Main tick: evaluate node engine and sync to scene */
  _evaluateAndSync(delta) {
    if (!this._initialized) return
    if (!nodeEngine.isDirty) return

    // Evaluate the DAG
    nodeEngine.evaluate()

    // Sync all scene_output nodes
    this._syncAllOutputs()

    // Clear dirty after sync
  }

  /** Sync all scene output nodes */
  _syncAllOutputs() {
    if (!sceneManager.scene) return

    // Find all scene_output nodes in the engine
    for (const [nodeId, node] of nodeEngine.nodes) {
      if (node.typeId === 'scene_output' || node.type === 'scene_output') {
        this._syncSceneOutput(nodeId, node)
      }
    }
  }

  /** Sync a single scene_output node to the Babylon scene */
  _syncSceneOutput(nodeId, node) {
    const cached = nodeEngine.getCachedResult(nodeId)
    if (!cached) return

    // Check if geometry changed (cache key)
    const geometryKey = cached.geometryKey || JSON.stringify(cached)
    const existing = this._sceneMeshes.get(nodeId)

    if (existing && this._geometryCache.get(nodeId) === geometryKey) {
      // No change, just update transforms
      this._updateTransform(existing, cached)
      return
    }

    // Create or update geometry
    const mesh = this._applyGeometryOperation(nodeId, cached, existing)
    if (mesh) {
      this._sceneMeshes.set(nodeId, mesh)
      this._geometryCache.set(nodeId, geometryKey)

      // Sync physics
      this._syncPhysicsBody(nodeId, mesh, cached)

      // Sync particle emitter
      this._syncParticleEmitter(nodeId, mesh, cached)

      // Update metadata
      mesh.metadata = mesh.metadata || {}
      mesh.metadata.nodeId = nodeId
    }
  }

  /** Apply geometry from node output to a Babylon mesh */
  _applyGeometryOperation(nodeId, cached, existingMesh) {
    const scene = sceneManager.scene
    if (!scene) return null

    const type = cached.primitiveType || cached.type || 'box'
    const params = cached.params || cached

    if (existingMesh) {
      existingMesh.dispose()
    }

    const mesh = PrimitiveFactory.createMesh(type, params, `node_${nodeId}`)
    if (!mesh) return null

    // Apply transform
    if (cached.position) {
      mesh.position = new Vector3(
        cached.position.x || 0,
        cached.position.y || 0,
        cached.position.z || 0
      )
    }
    if (cached.rotation) {
      mesh.rotation = new Vector3(
        cached.rotation.x || 0,
        cached.rotation.y || 0,
        cached.rotation.z || 0
      )
    }
    if (cached.scale) {
      mesh.scaling = new Vector3(
        cached.scale.x || 1,
        cached.scale.y || 1,
        cached.scale.z || 1
      )
    }

    // Set metadata
    mesh.metadata = { nodeId, primitiveType: type }

    return mesh
  }

  /** Update transform on an existing mesh */
  _updateTransform(mesh, cached) {
    if (cached.position) {
      mesh.position.set(
        cached.position.x || 0,
        cached.position.y || 0,
        cached.position.z || 0
      )
    }
    if (cached.rotation) {
      mesh.rotation.set(
        cached.rotation.x || 0,
        cached.rotation.y || 0,
        cached.rotation.z || 0
      )
    }
    if (cached.scale) {
      mesh.scaling.set(
        cached.scale.x || 1,
        cached.scale.y || 1,
        cached.scale.z || 1
      )
    }
  }

  /** Sync physics body for a node output */
  _syncPhysicsBody(nodeId, mesh, cached) {
    // CRITICAL: Skip physics in degraded mode
    if (physicsWorld._degraded || !physicsWorld.initialized) return

    const physConfig = cached.physics
    if (!physConfig || physConfig.enabled === false) {
      // Remove existing physics body
      if (this._physicsBodies.has(nodeId)) {
        physicsWorld.removeBody(mesh)
        this._physicsBodies.delete(nodeId)
      }
      return
    }

    // Add or update physics
    if (!this._physicsBodies.has(nodeId)) {
      const impostor = physicsWorld.addBody(mesh, physConfig.impostorType, {
        mass: physConfig.mass || 1,
        friction: physConfig.friction,
        restitution: physConfig.restitution
      })
      if (impostor) {
        this._physicsBodies.set(nodeId, impostor)
      }
    }
  }

  /** Sync particle emitter for a node output */
  _syncParticleEmitter(nodeId, mesh, cached) {
    const particleConfig = cached.particle
    if (!particleConfig || particleConfig.enabled === false) {
      // Remove existing particle system
      if (this._particleEmitters.has(nodeId)) {
        particleManager.removeSystem(this._particleEmitters.get(nodeId))
        this._particleEmitters.delete(nodeId)
      }
      return
    }

    // Update or create particle system
    if (this._particleEmitters.has(nodeId)) {
      particleManager.updateSystem(this._particleEmitters.get(nodeId), particleConfig)
    } else {
      const config = {
        ...particleConfig,
        emitter: mesh
      }
      const psId = particleManager.createSystem(config)
      if (psId) {
        this._particleEmitters.set(nodeId, psId)
      }
    }
  }

  /** Find the source mesh ID for a given node (traces upstream) */
  _findSourceMeshId(nodeId) {
    for (const [, link] of nodeEngine.links) {
      if (link.targetId === nodeId) {
        const sourceNode = nodeEngine.nodes.get(link.sourceId)
        if (sourceNode) {
          if (this._sceneMeshes.has(link.sourceId)) {
            return link.sourceId
          }
          // Recurse upstream
          const found = this._findSourceMeshId(link.sourceId)
          if (found) return found
        }
      }
    }
    return null
  }

  /** Remove a node's scene output */
  removeNodeOutput(nodeId) {
    const mesh = this._sceneMeshes.get(nodeId)
    if (mesh) {
      if (this._physicsBodies.has(nodeId)) {
        physicsWorld.removeBody(mesh)
        this._physicsBodies.delete(nodeId)
      }
      if (this._particleEmitters.has(nodeId)) {
        particleManager.removeSystem(this._particleEmitters.get(nodeId))
        this._particleEmitters.delete(nodeId)
      }
      mesh.dispose()
      this._sceneMeshes.delete(nodeId)
      this._geometryCache.delete(nodeId)
    }
  }

  /** Register render callback for auto-sync */
  registerRenderCallback() {
    if (!sceneManager.scene) return null
    return sceneManager.onBeforeRender((delta) => {
      this._evaluateAndSync(delta)
    })
  }

  destroy() {
    for (const [nodeId] of this._sceneMeshes) {
      this.removeNodeOutput(nodeId)
    }
    this._sceneMeshes.clear()
    this._physicsBodies.clear()
    this._particleEmitters.clear()
    this._geometryCache.clear()
    this._initialized = false
  }
}

const nodeSceneSync = new NodeSceneSync()
export default nodeSceneSync
export { NodeSceneSync }