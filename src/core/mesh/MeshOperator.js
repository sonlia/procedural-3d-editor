/**
 * Mesh Operations Wrapper
 * Static methods that delegate to HalfEdgeMesh and mesh utility modules
 */
import { Mesh, VertexData } from '@babylonjs/core'
import HalfEdgeMesh from './HalfEdgeMesh.js'
import { rebuildBabylonFromHE, transferMeshData, fillFaceFromEdges } from './mesh-utils.js'
import { subdivide, catmullClarkSubdivide } from './mesh-subdivide.js'
import { booleanCSG, mergeMeshes } from './mesh-boolean.js'
import emitter, { MESH_EVENTS } from '../eventBus.js'

class MeshOperator {
  /** Transfer vertex data from source to target Babylon mesh */
  static _transferMeshData(source, target) {
    transferMeshData(source, target)
  }

  /** Rebuild a Babylon.js mesh from a HalfEdgeMesh */
  static rebuildBabylonFromHE(babylonMesh, heMesh) {
    return rebuildBabylonFromHE(babylonMesh, heMesh)
  }

  /** Extrude selected faces */
  static extrudeFaces(heMesh, faceIds, amount = 0.5) {
    for (const fid of faceIds) {
      heMesh.extrudeFace(fid, amount)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'extrude' })
    return heMesh
  }

  /** Inset selected faces */
  static insetFaces(heMesh, faceIds, amount = 0.2) {
    for (const fid of faceIds) {
      heMesh.insetFace(fid, amount)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'inset' })
    return heMesh
  }

  /** Bevel selected edges */
  static bevelEdges(heMesh, edgeIds, radius = 0.1, segments = 1) {
    for (const eid of edgeIds) {
      heMesh.bevelEdge(eid, radius, segments)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'bevel' })
    return heMesh
  }

  /** Delete vertices */
  static deleteVertices(heMesh, vertexIds) {
    for (const vid of vertexIds) {
      heMesh.deleteVertex(vid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'delete_vertex' })
    return heMesh
  }

  /** Delete edges */
  static deleteEdges(heMesh, edgeIds) {
    for (const eid of edgeIds) {
      heMesh.deleteEdge(eid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'delete_edge' })
    return heMesh
  }

  /** Delete faces */
  static deleteFaces(heMesh, faceIds) {
    for (const fid of faceIds) {
      heMesh.deleteFace(fid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'delete_face' })
    return heMesh
  }

  /** Split edges */
  static splitEdges(heMesh, edgeIds) {
    const newVerts = []
    for (const eid of edgeIds) {
      const v = heMesh.splitEdge(eid)
      if (v !== null) newVerts.push(v)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'split_edge' })
    return newVerts
  }

  /** Flip edges */
  static flipEdges(heMesh, edgeIds) {
    for (const eid of edgeIds) {
      heMesh.flipEdge(eid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'flip_edge' })
    return heMesh
  }

  /** Loop cut */
  static loopCut(heMesh, faceId, edgeIndex, cuts) {
    return heMesh.loopCut(faceId, edgeIndex, cuts)
  }

  /** Weld vertices within tolerance */
  static weldVertices(heMesh, vertexIds, tol = 0.001) {
    heMesh.weldVertices(vertexIds, tol)
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'weld' })
    return heMesh
  }

  /** Bridge two loops */
  static bridge(heMesh, loopA, loopB) {
    heMesh.bridgeLoops(loopA, loopB)
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'bridge' })
    return heMesh
  }

  /** Triangulate all non-triangular faces */
  static triangulate(heMesh) {
    const result = heMesh.triangulate()
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'triangulate' })
    return result
  }

  /** CSG Boolean operation on two Babylon meshes */
  static booleanCSG(meshA, meshB, operation) {
    return booleanCSG(meshA, meshB, operation)
  }

  /** Merge two Babylon meshes */
  static mergeMeshes(meshA, meshB) {
    return mergeMeshes(meshA, meshB)
  }

  /** Fill face from edge loop */
  static fillFaceFromEdges(mesh, edgeLoop) {
    return fillFaceFromEdges(mesh, edgeLoop)
  }

  /** Simple subdivision */
  static subdivide(heMesh) {
    const result = subdivide(heMesh)
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'subdivide' })
    return result
  }

  /** Catmull-Clark smooth subdivision */
  static catmullClarkSubdivide(heMesh) {
    const result = catmullClarkSubdivide(heMesh)
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'catmull_clark' })
    return result
  }

  /** Flip face normals */
  static flipFaceNormals(heMesh, faceIds) {
    for (const fid of faceIds) {
      heMesh.flipFaceNormal(fid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'flip_face' })
    return heMesh
  }

  /** Dissolve edges (merge adjacent faces) */
  static dissolveEdges(heMesh, edgeIds) {
    for (const eid of edgeIds) {
      heMesh.dissolveEdge(eid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'dissolve_edge' })
    return heMesh
  }

  /** Dissolve faces */
  static dissolveFaces(heMesh, faceIds) {
    for (const fid of faceIds) {
      heMesh.deleteFace(fid)
    }
    heMesh.cleanOrphans()
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'dissolve_face' })
    return heMesh
  }

  /** Collapse edges */
  static collapseEdges(heMesh, edgeIds) {
    for (const eid of edgeIds) {
      heMesh.collapseEdge(eid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'collapse_edge' })
    return heMesh
  }

  /** Collapse vertices */
  static collapseVertices(heMesh, vertexIds) {
    for (const vid of vertexIds) {
      heMesh.collapseVertex(vid)
    }
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'collapse_vertex' })
    return heMesh
  }

  /** Separate selected faces into a new mesh */
  static separateFaces(babylonMesh, heMesh, faceIds) {
    if (!babylonMesh || !heMesh || faceIds.length === 0) return null

    // Clone the HE mesh
    const original = heMesh.clone()

    // Clone and keep only selected faces
    const separatedHE = heMesh.clone()
    const allFaceIds = [...separatedHE.faces.keys()]
    const toDelete = allFaceIds.filter(f => !faceIds.includes(f))
    for (const fid of toDelete) {
      separatedHE.deleteFace(fid)
    }
    separatedHE.cleanOrphans()

    // Remove selected faces from original
    for (const fid of faceIds) {
      original.deleteFace(fid)
    }
    original.cleanOrphans()

    // Rebuild original mesh
    rebuildBabylonFromHE(babylonMesh, original)

    // Create new mesh for separated faces
    const scene = babylonMesh.getScene()
    if (!scene) return null

    const newMesh = new Mesh(`separated_${Date.now()}`, scene)
    rebuildBabylonFromHE(newMesh, separatedHE)

    if (babylonMesh.material) {
      newMesh.material = babylonMesh.material
    }
    newMesh.position = babylonMesh.position.clone()

    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { operation: 'separate' })
    return { originalMesh: babylonMesh, separatedMesh: newMesh, originalHE: original, separatedHE }
  }
}

export default MeshOperator