/**
 * Subdivision operations for HalfEdgeMesh
 */
import HalfEdgeMesh from './HalfEdgeMesh.js'

/**
 * Simple midpoint subdivision
 * Each triangle is split into 4 triangles by inserting midpoints on each edge
 * @param {HalfEdgeMesh} heMesh
 * @returns {HalfEdgeMesh} New subdivided mesh
 */
export function subdivide(heMesh) {
  const result = new HalfEdgeMesh()

  // Build edge midpoint map
  const edgeMidpoints = new Map() // "from-to" → newVertexId

  for (const [faceId] of heMesh.faces) {
    const verts = heMesh.getFaceVertices(faceId)
    if (verts.length !== 3) continue

    // Get or create midpoints for each edge
    const mids = []
    for (let i = 0; i < 3; i++) {
      const a = verts[i]
      const b = verts[(i + 1) % 3]
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`

      if (edgeMidpoints.has(key)) {
        mids.push(edgeMidpoints.get(key))
      } else {
        const va = heMesh.getVertex(a)
        const vb = heMesh.getVertex(b)
        const mid = result.addVertex(
          (va.x + vb.x) / 2,
          (va.y + vb.y) / 2,
          (va.z + vb.z) / 2
        )
        edgeMidpoints.set(key, mid)
        mids.push(mid)
      }
    }

    // Copy original vertices to result if not already present
    for (const vid of verts) {
      if (!result.vertices.has(vid)) {
        const v = heMesh.getVertex(vid)
        result.addVertex(v.x, v.y, v.z)
      }
    }

    // Create 4 triangles
    // Center triangle
    result.addFace([mids[0], mids[1], mids[2]])
    // Corner triangles
    result.addFace([verts[0], mids[0], mids[2]])
    result.addFace([verts[1], mids[1], mids[0]])
    result.addFace([verts[2], mids[2], mids[1]])
  }

  return result
}

/**
 * Catmull-Clark subdivision
 * For each face: compute face point (average of vertices)
 * For each edge: compute edge point (average of endpoints + adjacent face points)
 * For each vertex: compute new vertex (1/n * (face_points_avg + 2 * edge_midpoints_avg + (n-3) * vertex))
 * @param {HalfEdgeMesh} heMesh
 * @returns {HalfEdgeMesh} New subdivided mesh
 */
export function catmullClarkSubdivide(heMesh) {
  const result = new HalfEdgeMesh()

  // Step 1: Compute face points (centroid of each face's vertices)
  const facePoints = new Map() // faceId → { x, y, z, newId }
  for (const [faceId] of heMesh.faces) {
    const verts = heMesh.getFaceVertices(faceId)
    let cx = 0, cy = 0, cz = 0
    for (const vid of verts) {
      const v = heMesh.getVertex(vid)
      cx += v.x; cy += v.y; cz += v.z
    }
    const n = verts.length
    const fp = { x: cx / n, y: cy / n, z: cz / n }
    fp.newId = result.addVertex(fp.x, fp.y, fp.z)
    facePoints.set(faceId, fp)
  }

  // Step 2: Compute edge points
  const edgePoints = new Map() // "minV-maxV" → { x, y, z, newId }
  const processedEdges = new Set()
  for (const [heId, he] of heMesh.halfEdges) {
    if (he.twin === null || he.twin === undefined) continue
    const from = he.vertex
    const to = heMesh.halfEdges.get(he.next)?.vertex
    if (to === undefined) continue

    const key = `${Math.min(from, to)}-${Math.max(from, to)}`
    if (processedEdges.has(key)) continue
    processedEdges.add(key)

    const v1 = heMesh.getVertex(from)
    const v2 = heMesh.getVertex(to)

    // Edge point = average of two endpoints + two face points
    let ep = { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z, count: 2 }

    const fp1 = facePoints.get(he.face)
    if (fp1) { ep.x += fp1.x; ep.y += fp1.y; ep.z += fp1.z; ep.count++ }

    const twinHe = heMesh.halfEdges.get(he.twin)
    if (twinHe) {
      const fp2 = facePoints.get(twinHe.face)
      if (fp2) { ep.x += fp2.x; ep.y += fp2.y; ep.z += fp2.z; ep.count++ }
    }

    ep.x /= ep.count
    ep.y /= ep.count
    ep.z /= ep.count
    ep.newId = result.addVertex(ep.x, ep.y, ep.z)
    edgePoints.set(key, ep)
  }

  // Step 3: Compute new vertex positions
  const newVertexIds = new Map() // oldVid → newVid
  for (const [vid, v] of heMesh.vertices) {
    // Gather adjacent face points and edge midpoints
    const adjFaces = []
    const adjEdgeMids = []

    const startHe = heMesh.vertexToHalfEdge.get(vid)
    if (startHe !== undefined) {
      let current = startHe
      const visited = new Set()
      while (current !== undefined && current !== null && !visited.has(current)) {
        visited.add(current)
        const cHe = heMesh.halfEdges.get(current)
        if (!cHe) break

        // Face point
        if (cHe.face !== null && cHe.face !== undefined) {
          const fp = facePoints.get(cHe.face)
          if (fp) adjFaces.push(fp)
        }

        // Edge midpoint (from this vertex to next vertex)
        const nextVid = heMesh.halfEdges.get(cHe.next)?.vertex
        if (nextVid !== undefined) {
          const nv = heMesh.getVertex(nextVid)
          adjEdgeMids.push({ x: (v.x + nv.x) / 2, y: (v.y + nv.y) / 2, z: (v.z + nv.z) / 2 })
        }

        current = cHe.next
        if (current === startHe) break
      }
    }

    const n = adjFaces.length
    let nx, ny, nz

    if (n === 0) {
      nx = v.x; ny = v.y; nz = v.z
    } else {
      // F = average of face points
      let fx = 0, fy = 0, fz = 0
      for (const fp of adjFaces) { fx += fp.x; fy += fp.y; fz += fp.z }
      fx /= n; fy /= n; fz /= n

      // R = average of edge midpoints
      let rx = 0, ry = 0, rz = 0
      for (const em of adjEdgeMids) { rx += em.x; ry += em.y; rz += em.z }
      rx /= n; ry /= n; rz /= n

      // New vertex = (F + 2R + (n-3)*P) / n
      nx = (fx + 2 * rx + (n - 3) * v.x) / n
      ny = (fy + 2 * ry + (n - 3) * v.y) / n
      nz = (fz + 2 * rz + (n - 3) * v.z) / n
    }

    const newId = result.addVertex(nx, ny, nz)
    newVertexIds.set(vid, newId)
  }

  // Step 4: Create new faces
  for (const [faceId] of heMesh.faces) {
    const verts = heMesh.getFaceVertices(faceId)
    const fp = facePoints.get(faceId)
    if (!fp) continue

    for (let i = 0; i < verts.length; i++) {
      const next = (i + 1) % verts.length

      const a = newVertexIds.get(verts[i])
      const b = edgePoints.get(`${Math.min(verts[i], verts[next])}-${Math.max(verts[i], verts[next])}`)?.newId
      const c = fp.newId
      const d = edgePoints.get(`${Math.min(verts[(i - 1 + verts.length) % verts.length], verts[i])}-${Math.max(verts[(i - 1 + verts.length) % verts.length], verts[i])}`)?.newId

      if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
        result.addFace([a, b, c, d])
      }
    }
  }

  return result
}