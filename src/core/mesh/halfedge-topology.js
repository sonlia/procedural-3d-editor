/**
 * Half-edge topology utilities
 * Edge loop detection, boundary analysis, connectivity queries
 */
import HalfEdgeMesh from './HalfEdgeMesh.js'

/**
 * Find all edge loops in the mesh
 * An edge loop is a sequence of connected edges where each edge shares a face with the next
 * @param {HalfEdgeMesh} heMesh
 * @returns {Array<{vertices: number[], halfEdges: number[]}>}
 */
export function findEdgeLoops(heMesh) {
  const loops = []
  const visitedEdges = new Set()

  for (const [heId, he] of heMesh.halfEdges) {
    if (visitedEdges.has(heId)) continue
    if (he.twin === null || he.twin === undefined) continue

    // Try to extend this edge into a loop
    const loop = _extendLoop(heMesh, heId, visitedEdges)
    if (loop && loop.vertices.length >= 2) {
      loops.push(loop)
      for (const id of loop.halfEdges) {
        visitedEdges.add(id)
      }
    }
  }

  return loops
}

function _extendLoop(heMesh, startHeId, visitedEdges) {
  const vertices = []
  const halfEdges = []
  let current = startHeId
  const maxIter = heMesh.halfEdgeCount + 1
  let iter = 0

  while (current !== undefined && current !== null && iter < maxIter) {
    iter++
    const he = heMesh.halfEdges.get(current)
    if (!he) break

    vertices.push(he.vertex)
    halfEdges.push(current)

    // Find next edge: the twin's next that's not our incoming edge
    if (he.twin === null || he.twin === undefined) break

    const twin = heMesh.halfEdges.get(he.twin)
    if (!twin) break

    const nextCandidate = twin.next
    if (nextCandidate === startHeId) {
      // Closed loop
      break
    }

    if (nextCandidate === null || nextCandidate === undefined) break
    if (halfEdges.includes(nextCandidate)) break

    current = nextCandidate
  }

  return { vertices, halfEdges }
}

/**
 * Get all boundary edges (half-edges without twins)
 * @param {HalfEdgeMesh} heMesh
 * @returns {number[]}
 */
export function getBoundaryEdges(heMesh) {
  const boundary = []
  for (const [id, he] of heMesh.halfEdges) {
    if (he.twin === null || he.twin === undefined) {
      boundary.push(id)
    }
  }
  return boundary
}

/**
 * Check if a mesh is manifold (all edges have exactly one twin)
 * @param {HalfEdgeMesh} heMesh
 * @returns {boolean}
 */
export function isManifold(heMesh) {
  for (const [id, he] of heMesh.halfEdges) {
    if (he.twin === null || he.twin === undefined) return false
  }
  return heMesh.faces.size > 0
}

/**
 * Check if a mesh is closed (no boundary edges)
 * @param {HalfEdgeMesh} heMesh
 * @returns {boolean}
 */
export function isClosed(heMesh) {
  for (const [, he] of heMesh.halfEdges) {
    if (he.twin === null || he.twin === undefined) return false
  }
  return true
}

/**
 * Get Euler characteristic: V - E + F
 * @param {HalfEdgeMesh} heMesh
 * @returns {number}
 */
export function eulerCharacteristic(heMesh) {
  return heMesh.vertexCount - heMesh.edgeCount + heMesh.faceCount
}

/**
 * Get connected components (each component is a Set of face IDs)
 * @param {HalfEdgeMesh} heMesh
 * @returns {Set<number>[]}
 */
export function getConnectedComponents(heMesh) {
  const visited = new Set()
  const components = []

  for (const [faceId] of heMesh.faces) {
    if (visited.has(faceId)) continue

    const component = new Set()
    const queue = [faceId]

    while (queue.length > 0) {
      const current = queue.shift()
      if (visited.has(current)) continue
      visited.add(current)
      component.add(current)

      // Find adjacent faces via twin edges
      const face = heMesh.faces.get(current)
      if (!face) continue

      let heId = face.halfEdge
      const seen = new Set()
      while (heId !== undefined && heId !== null && !seen.has(heId)) {
        seen.add(heId)
        const he = heMesh.halfEdges.get(heId)
        if (!he) break

        if (he.twin !== null && he.twin !== undefined) {
          const twin = heMesh.halfEdges.get(he.twin)
          if (twin && twin.face !== null && twin.face !== undefined && !visited.has(twin.face)) {
            queue.push(twin.face)
          }
        }

        heId = he.next
        if (heId === face.halfEdge) break
      }
    }

    if (component.size > 0) components.push(component)
  }

  return components
}

/**
 * Get vertex valence (number of edges connected to a vertex)
 * @param {HalfEdgeMesh} heMesh
 * @param {number} vertexId
 * @returns {number}
 */
export function getVertexValence(heMesh, vertexId) {
  const startHe = heMesh.vertexToHalfEdge.get(vertexId)
  if (startHe === undefined) return 0

  let count = 0
  let current = startHe
  const visited = new Set()
  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    count++
    const he = heMesh.halfEdges.get(current)
    if (!he) break
    current = he.next
    if (current === startHe) break
  }
  return count
}

/**
 * Get all faces adjacent to a vertex
 * @param {HalfEdgeMesh} heMesh
 * @param {number} vertexId
 * @returns {number[]}
 */
export function getVertexFaces(heMesh, vertexId) {
  const faces = []
  const startHe = heMesh.vertexToHalfEdge.get(vertexId)
  if (startHe === undefined) return faces

  let current = startHe
  const visited = new Set()
  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    const he = heMesh.halfEdges.get(current)
    if (!he) break
    if (he.face !== null && he.face !== undefined) {
      faces.push(he.face)
    }
    current = he.next
    if (current === startHe) break
  }
  return faces
}