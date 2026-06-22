/**
 * Half-edge editing operations
 * Provides utility functions for complex half-edge operations
 * Re-exports commonly used operations from HalfEdgeMesh
 */
import HalfEdgeMesh from './HalfEdgeMesh.js'

/**
 * Extrude multiple faces at once
 * @param {HalfEdgeMesh} heMesh
 * @param {number[]} faceIds
 * @param {number} amount
 */
export function extrudeMultipleFaces(heMesh, faceIds, amount) {
  const newFaceIds = []
  for (const fid of faceIds) {
    const newId = heMesh.extrudeFace(fid, amount)
    if (newId) newFaceIds.push(newId)
  }
  return newFaceIds
}

/**
 * Inset multiple faces at once
 * @param {HalfEdgeMesh} heMesh
 * @param {number[]} faceIds
 * @param {number} amount
 */
export function insetMultipleFaces(heMesh, faceIds, amount) {
  for (const fid of faceIds) {
    heMesh.insetFace(fid, amount)
  }
}

/**
 * Delete multiple faces
 * @param {HalfEdgeMesh} heMesh
 * @param {number[]} faceIds
 */
export function deleteMultipleFaces(heMesh, faceIds) {
  for (const fid of faceIds) {
    heMesh.deleteFace(fid)
  }
  heMesh.cleanOrphans()
}

/**
 * Flip normals of multiple faces
 * @param {HalfEdgeMesh} heMesh
 * @param {number[]} faceIds
 */
export function flipMultipleNormals(heMesh, faceIds) {
  for (const fid of faceIds) {
    heMesh.flipFaceNormal(fid)
  }
}

/**
 * Get the half-edge ID connecting two vertices (directed)
 * @param {HalfEdgeMesh} heMesh
 * @param {number} fromV
 * @param {number} toV
 * @returns {number|null}
 */
export function findHalfEdge(heMesh, fromV, toV) {
  const startHe = heMesh.vertexToHalfEdge.get(fromV)
  if (startHe === undefined) return null

  let current = startHe
  const visited = new Set()
  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    const he = heMesh.halfEdges.get(current)
    if (!he) break
    const targetV = heMesh.halfEdges.get(he.next)?.vertex
    if (targetV === toV) return current
    current = he.next
    if (current === startHe) break
  }
  return null
}

/**
 * Get all half-edge IDs for a given edge (pair of vertices)
 * @param {HalfEdgeMesh} heMesh
 * @param {number} v1
 * @param {number} v2
 * @returns {number[]}
 */
export function getEdgeHalfEdges(heMesh, v1, v2) {
  const result = []
  const he1 = findHalfEdge(heMesh, v1, v2)
  if (he1 !== null) result.push(he1)
  const he2 = findHalfEdge(heMesh, v2, v1)
  if (he2 !== null) result.push(he2)
  return result
}

/**
 * Get all edges connected to a vertex
 * @param {HalfEdgeMesh} heMesh
 * @param {number} vertexId
 * @returns {Array<{from: number, to: number, heId: number}>}
 */
export function getVertexEdges(heMesh, vertexId) {
  const edges = []
  const startHe = heMesh.vertexToHalfEdge.get(vertexId)
  if (startHe === undefined) return edges

  let current = startHe
  const visited = new Set()
  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    const he = heMesh.halfEdges.get(current)
    if (!he) break
    const toV = heMesh.halfEdges.get(he.next)?.vertex
    if (toV !== undefined) {
      edges.push({ from: vertexId, to: toV, heId: current })
    }
    current = he.next
    if (current === startHe) break
  }

  return edges
}