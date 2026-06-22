/**
 * Modeling Tool Event Handler
 * Handles modeling tool events from MESH_EVENTS and dispatches to MeshOperator/HalfEdgeMesh
 */
import { MESH_EVENTS, SELECTION_EVENTS } from '../eventBus.js'
import emitter from '../eventBus.js'
import selectionManager from './SelectionManager.js'
import viewportEditor from './ViewportEditor.js'
import sceneManager from '../scene/SceneManager.js'
import MeshOperator from '../mesh/MeshOperator.js'
import HalfEdgeMesh from '../mesh/HalfEdgeMesh.js'
import { rebuildBabylonFromHE } from '../mesh/mesh-utils.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useSceneStore } from '../../stores/sceneStore.js'
import undoRedoManager from '../undo/UndoRedoManager.js'

class ModelingToolHandler {
  constructor() {
    this._heMeshCache = new Map() // objectId → HalfEdgeMesh
    this._initialized = false
  }

  init() {
    if (this._initialized) return
    this._initialized = true
    console.log('[ModelingToolHandler] Initialized.')

    // Listen for modeling tool events
    emitter.on(MESH_EVENTS.MESH_CHANGED, (data) => this._onMeshChanged(data))
    emitter.on(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, (data) => this._onTopologyChanged(data))
  }

  /** Get or create HalfEdgeMesh for a scene object */
  getHEMesh(objectId) {
    if (this._heMeshCache.has(objectId)) {
      return this._heMeshCache.get(objectId)
    }

    const babylonMesh = this.getBabylonMesh(objectId)
    if (!babylonMesh) return null

    const heMesh = HalfEdgeMesh.fromBabylonMesh(babylonMesh)
    if (heMesh) {
      this._heMeshCache.set(objectId, heMesh)
    }
    return heMesh
  }

  /** Get Babylon.js mesh for a scene object */
  getBabylonMesh(objectId) {
    const scene = sceneManager.scene
    if (!scene) return null
    return scene.getMeshByName(objectId) || scene.getMeshesByTags(`objectId:${objectId}`)[0] || null
  }

  /** Find Babylon mesh by searching metadata */
  _findMeshByObjectId(objectId) {
    const scene = sceneManager.scene
    if (!scene) return null
    for (const mesh of scene.meshes) {
      if (mesh.metadata?.objectId === objectId) return mesh
    }
    return null
  }

  /** Execute a modeling tool */
  _executeTool(tool, params = {}) {
    const editorStore = useEditorStore()
    const sceneStore = useSceneStore()
    const selectedIds = selectionManager.selectedObjectIds

    if (selectedIds.length === 0 && tool !== 'boolean') {
      console.warn('[ModelingToolHandler] No object selected.')
      return null
    }

    const objectId = selectedIds[0]
    const heMesh = this.getHEMesh(objectId)
    const babylonMesh = this._findMeshByObjectId(objectId) || this.getBabylonMesh(objectId)

    switch (tool) {
      case 'extrude': {
        const faceIds = selectionManager.selectedFaces
        if (faceIds.length === 0) return null
        this._withUndo(objectId, 'Extrude', () => {
          MeshOperator.extrudeFaces(heMesh, faceIds, params.amount || 0.5)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'inset': {
        const faceIds = selectionManager.selectedFaces
        if (faceIds.length === 0) return null
        this._withUndo(objectId, 'Inset', () => {
          MeshOperator.insetFaces(heMesh, faceIds, params.amount || 0.2)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'bevel': {
        const edgeIds = selectionManager.selectedEdges
        if (edgeIds.length === 0) return null
        this._withUndo(objectId, 'Bevel', () => {
          MeshOperator.bevelEdges(heMesh, edgeIds, params.radius || 0.1, params.segments || 1)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'loop_cut': {
        this._withUndo(objectId, 'Loop Cut', () => {
          MeshOperator.loopCut(heMesh, params.faceId, params.edgeIndex, params.cuts || 1)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'knife': {
        // Knife tool: simple implementation using loop cut
        this._withUndo(objectId, 'Knife', () => {
          const faceIds = [...heMesh.faces.keys()]
          for (const fid of faceIds) {
            heMesh.loopCut(fid, 0, params.cuts || 1)
          }
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'bridge': {
        if (params.loopA && params.loopB) {
          this._withUndo(objectId, 'Bridge', () => {
            MeshOperator.bridge(heMesh, params.loopA, params.loopB)
            rebuildBabylonFromHE(babylonMesh, heMesh)
          })
        }
        break
      }
      case 'boolean': {
        if (params.meshA && params.meshB && params.operation) {
          const result = MeshOperator.booleanCSG(params.meshA, params.meshB, params.operation)
          return result
        }
        break
      }
      case 'merge': {
        if (params.meshA && params.meshB) {
          const result = MeshOperator.mergeMeshes(params.meshA, params.meshB)
          return result
        }
        break
      }
      case 'fill_face': {
        this._doFillFace(objectId, editorStore.editMode)
        break
      }
      case 'subdivide': {
        this._withUndo(objectId, 'Subdivide', () => {
          const newHE = MeshOperator.subdivide(heMesh)
          this._heMeshCache.set(objectId, newHE)
          rebuildBabylonFromHE(babylonMesh, newHE)
        })
        break
      }
      case 'subdivide_smooth': {
        this._withUndo(objectId, 'Catmull-Clark', () => {
          const newHE = MeshOperator.catmullClarkSubdivide(heMesh)
          this._heMeshCache.set(objectId, newHE)
          rebuildBabylonFromHE(babylonMesh, newHE)
        })
        break
      }
      case 'weld': {
        const verts = selectionManager.selectedVertices
        if (verts.length < 2) return null
        this._withUndo(objectId, 'Weld', () => {
          MeshOperator.weldVertices(heMesh, verts, params.tolerance || 0.001)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'flip_face': {
        const faceIds = selectionManager.selectedFaces
        if (faceIds.length === 0) return null
        this._withUndo(objectId, 'Flip Face', () => {
          MeshOperator.flipFaceNormals(heMesh, faceIds)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'delete_vertex': {
        const verts = selectionManager.selectedVertices
        if (verts.length === 0) return null
        this._withUndo(objectId, 'Delete Vertex', () => {
          MeshOperator.deleteVertices(heMesh, verts)
          rebuildBabylonFromHE(babylonMesh, heMesh)
          selectionManager.clearSelection()
        })
        break
      }
      case 'delete_edge': {
        const edges = selectionManager.selectedEdges
        if (edges.length === 0) return null
        this._withUndo(objectId, 'Delete Edge', () => {
          MeshOperator.deleteEdges(heMesh, edges)
          rebuildBabylonFromHE(babylonMesh, heMesh)
          selectionManager.clearSelection()
        })
        break
      }
      case 'delete_face': {
        const faces = selectionManager.selectedFaces
        if (faces.length === 0) return null
        this._withUndo(objectId, 'Delete Face', () => {
          MeshOperator.deleteFaces(heMesh, faces)
          rebuildBabylonFromHE(babylonMesh, heMesh)
          selectionManager.clearSelection()
        })
        break
      }
      case 'dissolve': {
        const edges = selectionManager.selectedEdges
        if (edges.length === 0) return null
        this._withUndo(objectId, 'Dissolve', () => {
          MeshOperator.dissolveEdges(heMesh, edges)
          rebuildBabylonFromHE(babylonMesh, heMesh)
        })
        break
      }
      case 'collapse_edge': {
        const edges = selectionManager.selectedEdges
        if (edges.length === 0) return null
        this._withUndo(objectId, 'Collapse Edge', () => {
          MeshOperator.collapseEdges(heMesh, edges)
          rebuildBabylonFromHE(babylonMesh, heMesh)
          selectionManager.clearSelection()
        })
        break
      }
      case 'collapse_vertex': {
        const verts = selectionManager.selectedVertices
        if (verts.length === 0) return null
        this._withUndo(objectId, 'Collapse Vertex', () => {
          MeshOperator.collapseVertices(heMesh, verts)
          rebuildBabylonFromHE(babylonMesh, heMesh)
          selectionManager.clearSelection()
        })
        break
      }
      case 'triangulate': {
        this._doTriangulate(objectId)
        break
      }
      case 'separate': {
        this._doSeparate(objectId)
        break
      }
      default:
        console.warn('[ModelingToolHandler] Unknown tool:', tool)
        return null
    }

    emitter.emit(MESH_EVENTS.MESH_CHANGED, { objectId, tool })
    return true
  }

  /** Triangulate all non-triangular faces */
  _doTriangulate(objectId) {
    const heMesh = this.getHEMesh(objectId)
    const babylonMesh = this._findMeshByObjectId(objectId) || this.getBabylonMesh(objectId)
    if (!heMesh || !babylonMesh) return

    this._withUndo(objectId, 'Triangulate', () => {
      MeshOperator.triangulate(heMesh)
      rebuildBabylonFromHE(babylonMesh, heMesh)
    })
  }

  /** Separate selected faces into a new mesh */
  _doSeparate(objectId) {
    const heMesh = this.getHEMesh(objectId)
    const babylonMesh = this._findMeshByObjectId(objectId) || this.getBabylonMesh(objectId)
    if (!heMesh || !babylonMesh) return

    const faceIds = selectionManager.selectedFaces
    if (faceIds.length === 0) {
      console.warn('[ModelingToolHandler] No faces selected for separate.')
      return
    }

    this._withUndo(objectId, 'Separate', () => {
      const result = MeshOperator.separateFaces(babylonMesh, heMesh, faceIds)
      if (result && result.separatedMesh) {
        // Add new mesh to sceneStore
        const sceneStore = useSceneStore()
        const newObj = sceneStore.addObject({
          name: `${objectId}_separated`,
          type: 'mesh',
          position: { x: 0, y: 0, z: 0 },
          metadata: { primitiveType: 'separated' }
        })

        if (newObj) {
          result.separatedMesh.metadata = result.separatedMesh.metadata || {}
          result.separatedMesh.metadata.objectId = newObj.id
          // Cache HE mesh for new object
          if (result.separatedHE) {
            this._heMeshCache.set(newObj.id, result.separatedHE)
          }
        }

        // Update original HE cache
        if (result.originalHE) {
          this._heMeshCache.set(objectId, result.originalHE)
        }
      }
    })

    selectionManager.clearSelection()
  }

  /** Fill face: validate selected edges form a closed loop, then fill */
  _doFillFace(objectId, editMode) {
    const heMesh = this.getHEMesh(objectId)
    const babylonMesh = this._findMeshByObjectId(objectId) || this.getBabylonMesh(objectId)
    if (!heMesh || !babylonMesh) return

    // Get boundary loops
    const boundaryLoops = heMesh.getBoundaryLoops()
    if (boundaryLoops.length === 0) {
      console.warn('[ModelingToolHandler] No boundary loops to fill.')
      return
    }

    this._withUndo(objectId, 'Fill Face', () => {
      for (const loop of boundaryLoops) {
        heMesh.fillBoundaryFace(loop)
      }
      rebuildBabylonFromHE(babylonMesh, heMesh)
    })
  }

  /** Wrap an operation with undo/redo support */
  _withUndo(objectId, name, fn) {
    const heMesh = this.getHEMesh(objectId)
    const babylonMesh = this._findMeshByObjectId(objectId) || this.getBabylonMesh(objectId)

    // Capture state before
    const beforeHE = heMesh ? heMesh.clone() : null
    const beforePositions = babylonMesh ? babylonMesh.getVerticesData('position') : null
    const beforeIndices = babylonMesh ? babylonMesh.getIndices() : null

    // Execute
    fn()

    // Create undo command
    undoRedoManager.execute({
      name,
      execute: () => {
        // Already executed above
      },
      undo: () => {
        if (beforeHE && heMesh && babylonMesh) {
          // Restore HE mesh
          const restored = beforeHE.clone()
          this._heMeshCache.set(objectId, restored)
          rebuildBabylonFromHE(babylonMesh, restored)
        }
      }
    })
  }

  /** Called when mesh geometry changes externally */
  _onMeshChanged(data) {
    if (data?.mesh?.metadata?.objectId) {
      this._heMeshCache.delete(data.mesh.metadata.objectId)
    }
  }

  /** Called when topology changes (rebuild HE cache) */
  _onTopologyChanged(data) {
    // HE cache is already updated in place, just emit events
  }

  /** Clear HE mesh cache for an object */
  invalidateCache(objectId) {
    this._heMeshCache.delete(objectId)
  }

  /** Clear all caches */
  clearCache() {
    this._heMeshCache.clear()
  }

  destroy() {
    this._heMeshCache.clear()
    this._initialized = false
  }
}

const modelingToolHandler = new ModelingToolHandler()
export default modelingToolHandler
export { ModelingToolHandler }