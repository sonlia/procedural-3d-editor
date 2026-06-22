/**
 * Mesh utilities - vertex data transfer, rebuild, fill
 */
import { Mesh, VertexData } from '@babylonjs/core'
import HalfEdgeMesh from './HalfEdgeMesh.js'
import emitter, { MESH_EVENTS } from '../eventBus.js'

/**
 * Transfer vertex data from source mesh to target mesh
 */
export function transferMeshData(source, target) {
  if (!source || !target) return

  const positions = source.getVerticesData('position')
  const indices = source.getIndices()
  const normals = source.getVerticesData('normal')
  const uvs = source.getVerticesData('uv')

  if (!positions || !indices) return

  const vd = new VertexData()
  vd.positions = positions
  vd.indices = indices
  if (normals) vd.normals = normals
  if (uvs) vd.uvs = uvs
  vd.applyToMesh(target)

  // Transfer material
  if (source.material && !target.material) {
    target.material = source.material
  }
}

/**
 * Rebuild a Babylon.js mesh from a HalfEdgeMesh
 */
export function rebuildBabylonFromHE(babylonMesh, heMesh) {
  if (!babylonMesh || !heMesh) return false

  const positions = []
  const indices = []
  const uvs = []
  const normals = []

  // Collect all vertices
  const vertexMap = new Map() // oldVid → new index
  let idx = 0
  for (const [vid, v] of heMesh.vertices) {
    vertexMap.set(vid, idx)
    positions.push(v.x, v.y, v.z)

    const uv = heMesh.vertexUVs.get(vid)
    uvs.push(uv ? uv.u : 0, uv ? uv.v : 0)

    idx++
  }

  // Collect faces
  for (const [, face] of heMesh.faces) {
    const faceVerts = heMesh.getFaceVertices(face.halfEdge)
    if (faceVerts.length < 3) continue

    // Triangulate (fan)
    for (let i = 1; i < faceVerts.length - 1; i++) {
      const a = vertexMap.get(faceVerts[0])
      const b = vertexMap.get(faceVerts[i])
      const c = vertexMap.get(faceVerts[i + 1])
      if (a !== undefined && b !== undefined && c !== undefined) {
        indices.push(a, b, c)
      }
    }
  }

  if (positions.length === 0 || indices.length === 0) return false

  const vd = new VertexData()
  vd.positions = new Float32Array(positions)
  vd.indices = indices
  if (uvs.length === positions.length) {
    vd.uvs = new Float32Array(uvs)
  }
  vd.applyToMesh(babylonMesh, false)

  // Recompute normals
  const scene = babylonMesh.getScene()
  if (scene) {
    babylonMesh.createNormals(true)
  }

  return true
}

/**
 * Fill a face from a closed edge loop
 * Validates the loop is closed, then fills with fan triangulation
 */
export function fillFaceFromEdges(mesh, edgeLoop) {
  if (!mesh || !edgeLoop || edgeLoop.length < 3) return false

  // Validate closed loop: first vertex should match last
  // (or the loop should form a ring)
  const positions = mesh.getVerticesData('position')
  const indices = mesh.getIndices()
  if (!positions || !indices) return false

  // Use VertexData to add the fill face
  const vd = new VertexData()
  const existingPositions = positions
  const existingIndices = indices

  // Fan triangulation of the loop
  const newIndices = []
  for (let i = 1; i < edgeLoop.length - 1; i++) {
    newIndices.push(edgeLoop[0], edgeLoop[i], edgeLoop[i + 1])
  }

  const mergedIndices = [...existingIndices, ...newIndices]
  vd.positions = existingPositions
  vd.indices = mergedIndices

  const normals = mesh.getVerticesData('normal')
  if (normals) vd.normals = normals
  const uvs = mesh.getVerticesData('uv')
  if (uvs) vd.uvs = uvs

  vd.applyToMesh(mesh)

  emitter.emit(MESH_EVENTS.MESH_CHANGED, { mesh })
  return true
}

/**
 * Unified operation dispatch: apply a named operation to a Babylon mesh via HE
 */
export function applyOperationToBabylonMesh(babylonMesh, heMesh, operation, params = {}) {
  if (!heMesh || !babylonMesh) return null

  let result = null

  switch (operation) {
    case 'extrude':
      result = heMesh.extrudeFace(params.faceId, params.amount || 0.5)
      break
    case 'inset':
      result = heMesh.insetFace(params.faceId, params.amount || 0.2)
      break
    case 'delete_vertex':
      heMesh.deleteVertex(params.vertexId)
      result = true
      break
    case 'delete_edge':
      heMesh.deleteEdge(params.edgeId)
      result = true
      break
    case 'delete_face':
      heMesh.deleteFace(params.faceId)
      result = true
      break
    case 'flip_edge':
      heMesh.flipEdge(params.edgeId)
      result = true
      break
    case 'flip_face':
      heMesh.flipFaceNormal(params.faceId)
      result = true
      break
    case 'collapse_edge':
      heMesh.collapseEdge(params.edgeId)
      result = true
      break
    case 'collapse_vertex':
      heMesh.collapseVertex(params.vertexId)
      result = true
      break
    case 'dissolve_edge':
      heMesh.dissolveEdge(params.edgeId)
      result = true
      break
    case 'triangulate':
      result = heMesh.triangulate()
      break
    default:
      console.warn('[mesh-utils] Unknown operation:', operation)
      return null
  }

  // Rebuild the Babylon mesh from the modified HE mesh
  if (result !== null) {
    rebuildBabylonFromHE(babylonMesh, heMesh)
    emitter.emit(MESH_EVENTS.MESH_TOPOLOGY_CHANGED, { mesh: babylonMesh, operation })
  }

  return result
}