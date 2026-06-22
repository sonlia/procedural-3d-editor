/**
 * Half-Edge Mesh Data Structure
 * Core data structure for procedural mesh editing operations
 */
class HalfEdgeMesh {
  constructor() {
    this.vertices = new Map()       // id → { x, y, z }
    this.halfEdges = new Map()      // id → { vertex, next, prev, twin, face, edge }
    this.faces = new Map()          // id → { halfEdge }
    this.vertexToHalfEdge = new Map() // vertexId → halfEdgeId (any HE starting at this vertex)
    this.vertexUVs = new Map()      // vertexId → { u, v }

    this._nextHalfEdgeId = 0
    this._nextFaceId = 0
    this._highestVertexId = -1
  }

  get vertexCount() { return this.vertices.size }
  get faceCount() { return this.faces.size }
  get halfEdgeCount() { return this.halfEdges.size }
  get edgeCount() {
    let count = 0
    const seen = new Set()
    for (const [id, he] of this.halfEdges) {
      if (!seen.has(id) && he.twin !== null && he.twin !== undefined) {
        seen.add(id)
        seen.add(he.twin)
        count++
      }
    }
    return count
  }

  /** Create a vertex, returns id */
  addVertex(x, y, z, uv) {
    this._highestVertexId++
    const id = this._highestVertexId
    this.vertices.set(id, { x, y, z })
    if (uv) this.vertexUVs.set(id, { u: uv.u, v: uv.v })
    return id
  }

  /** Create a face from ordered vertex IDs. Returns faceId. */
  addFace(vertexIds) {
    if (vertexIds.length < 3) return null
    const faceId = this._nextFaceId++
    const heIds = []

    for (let i = 0; i < vertexIds.length; i++) {
      const heId = this._nextHalfEdgeId++
      heIds.push(heId)

      this.halfEdges.set(heId, {
        vertex: vertexIds[i],
        next: null,
        prev: null,
        twin: null,
        face: faceId,
        edge: null
      })

      if (!this.vertexToHalfEdge.has(vertexIds[i])) {
        this.vertexToHalfEdge.set(vertexIds[i], heId)
      }
    }

    // Link next/prev
    for (let i = 0; i < heIds.length; i++) {
      this.halfEdges.get(heIds[i]).next = heIds[(i + 1) % heIds.length]
      this.halfEdges.get(heIds[i]).prev = heIds[(i - 1 + heIds.length) % heIds.length]
    }

    this.faces.set(faceId, { halfEdge: heIds[0] })

    // Try to find and link twins
    this._linkTwins(heIds, vertexIds)

    return faceId
  }

  _linkTwins(heIds, vertexIds) {
    for (let i = 0; i < heIds.length; i++) {
      const he = this.halfEdges.get(heIds[i])
      const from = he.vertex
      const to = this.halfEdges.get(he.next).vertex

      // Find existing half-edge going from 'to' to 'from'
      const toHeId = this.vertexToHalfEdge.get(to)
      if (toHeId === undefined) continue

      let current = toHeId
      const visited = new Set()
      while (current !== undefined && current !== null && !visited.has(current)) {
        visited.add(current)
        const candidate = this.halfEdges.get(current)
        if (!candidate) break
        const candidateTarget = this.halfEdges.get(candidate.next)
        if (candidateTarget && candidateTarget.vertex === from && candidate.twin === null) {
          he.twin = current
          candidate.twin = heIds[i]
          break
        }
        current = candidate.next
        if (current === toHeId) break
      }
    }
  }

  /** Get vertex position */
  getVertex(id) {
    return this.vertices.get(id) || null
  }

  /** Set vertex position */
  setVertex(id, x, y, z) {
    if (this.vertices.has(id)) {
      this.vertices.set(id, { x, y, z })
    }
  }

  /** Get face vertex IDs in order */
  getFaceVertices(faceId) {
    const face = this.faces.get(faceId)
    if (!face) return []

    const verts = []
    const startHe = face.halfEdge
    let current = startHe
    const visited = new Set()

    while (current !== undefined && current !== null && !visited.has(current)) {
      visited.add(current)
      const he = this.halfEdges.get(current)
      if (!he) break
      verts.push(he.vertex)
      current = he.next
      if (current === startHe) break
    }

    return verts
  }

  /** Get the twin half-edge ID for a directed edge (from → to) */
  _findTwin(from, to) {
    const startHe = this.vertexToHalfEdge.get(from)
    if (startHe === undefined) return null

    let current = startHe
    const visited = new Set()
    while (current !== undefined && current !== null && !visited.has(current)) {
      visited.add(current)
      const he = this.halfEdges.get(current)
      if (!he) break
      const target = this.halfEdges.get(he.next)
      if (target && target.vertex === to) return current
      current = he.next
      if (current === startHe) break
    }
    return null
  }

  /** Extrude a face along its normal by amount */
  extrudeFace(faceId, amount) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length < 3) return null

    // Compute face normal
    const normal = this._computeFaceNormal(faceId)

    // Create new vertices offset by normal * amount
    const newVerts = verts.map(vid => {
      const v = this.vertices.get(vid)
      return this.addVertex(
        v.x + normal.x * amount,
        v.y + normal.y * amount,
        v.z + normal.z * amount
      )
    })

    // Create side faces connecting old ring to new ring
    for (let i = 0; i < verts.length; i++) {
      const next = (i + 1) % verts.length
      this.addFace([verts[next], verts[i], newVerts[i], newVerts[next]])
    }

    // Update original face to use new vertices
    this._replaceFaceVertices(faceId, newVerts)

    // Create new top face with reversed winding to face outward
    return this.addFace([...newVerts].reverse())
  }

  /** Inset a face by amount (moves edges inward) */
  insetFace(faceId, amount) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length < 3) return null

    const center = this._computeFaceCenter(faceId)

    // Create inset vertices (move toward center)
    const newVerts = verts.map(vid => {
      const v = this.vertices.get(vid)
      return this.addVertex(
        v.x + (center.x - v.x) * amount,
        v.y + (center.y - v.y) * amount,
        v.z + (center.z - v.z) * amount
      )
    })

    // Create side quads
    for (let i = 0; i < verts.length; i++) {
      const next = (i + 1) % verts.length
      this.addFace([verts[i], verts[next], newVerts[next], newVerts[i]])
    }

    // Original face becomes the inset face
    this._replaceFaceVertices(faceId, newVerts)
    return faceId
  }

  /** Bevel an edge */
  bevelEdge(edgeId, radius, segments = 1) {
    // Find half-edges belonging to this edge
    let heId = edgeId
    const he = this.halfEdges.get(heId)
    if (!he) return null

    const twinId = he.twin
    if (twinId === null || twinId === undefined) return null

    // Simple bevel: split edge and offset
    const v1 = this.vertices.get(he.vertex)
    const v2 = this.vertices.get(this.halfEdges.get(he.next).vertex)

    const edgeDir = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z }
    const len = Math.sqrt(edgeDir.x ** 2 + edgeDir.y ** 2 + edgeDir.z ** 2)
    if (len === 0) return null

    // Midpoint offset (simplified bevel)
    const mid = {
      x: (v1.x + v2.x) / 2,
      y: (v1.y + v2.y) / 2,
      z: (v1.z + v2.z) / 2
    }

    const newV = this.addVertex(mid.x, mid.y, mid.z)
    this.splitEdge(heId)
    return newV
  }

  /** Delete a vertex and all connected faces/edges */
  deleteVertex(id) {
    // Find all half-edges starting at this vertex
    const heIds = []
    const startHe = this.vertexToHalfEdge.get(id)
    if (startHe !== undefined) {
      let current = startHe
      const visited = new Set()
      while (current !== undefined && current !== null && !visited.has(current)) {
        visited.add(current)
        heIds.push(current)
        const he = this.halfEdges.get(current)
        if (!he) break
        current = he.next
        if (current === startHe) break
      }
    }

    // Collect faces to delete
    const faceIds = new Set()
    for (const heId of heIds) {
      const he = this.halfEdges.get(heId)
      if (he && he.face !== null && he.face !== undefined) {
        faceIds.add(he.face)
      }
    }

    // Delete faces
    for (const fId of faceIds) {
      this.deleteFace(fId)
    }

    this.vertices.delete(id)
    this.vertexToHalfEdge.delete(id)
    this.vertexUVs.delete(id)
    this.cleanOrphans()
  }

  /** Delete an edge and its two adjacent faces */
  deleteEdge(id) {
    const he = this.halfEdges.get(id)
    if (!he) return

    const facesToDelete = new Set()
    if (he.face !== null && he.face !== undefined) facesToDelete.add(he.face)
    if (he.twin !== null && he.twin !== undefined) {
      const twin = this.halfEdges.get(he.twin)
      if (twin && twin.face !== null && twin.face !== undefined) facesToDelete.add(twin.face)
    }

    for (const fId of facesToDelete) {
      this.deleteFace(fId)
    }
    this.cleanOrphans()
  }

  /** Delete a face and its half-edges */
  deleteFace(id) {
    const face = this.faces.get(id)
    if (!face) return

    const heIds = []
    let current = face.halfEdge
    const visited = new Set()
    while (current !== undefined && current !== null && !visited.has(current)) {
      visited.add(current)
      heIds.push(current)
      const he = this.halfEdges.get(current)
      if (!he) break
      current = he.next
      if (current === face.halfEdge) break
    }

    // Untwin and remove
    for (const heId of heIds) {
      const he = this.halfEdges.get(heId)
      if (he) {
        if (he.twin !== null && he.twin !== undefined) {
          const twin = this.halfEdges.get(he.twin)
          if (twin) twin.twin = null
        }
        this.halfEdges.delete(heId)
      }
    }

    this.faces.delete(id)
  }

  /** Split an edge: insert a new vertex at midpoint */
  splitEdge(id) {
    const he = this.halfEdges.get(id)
    if (!he) return null
    const nextHe = this.halfEdges.get(he.next)
    if (!nextHe) return null

    const v1 = this.vertices.get(he.vertex)
    const v2 = this.vertices.get(nextHe.vertex)
    const newId = this.addVertex(
      (v1.x + v2.x) / 2,
      (v1.y + v2.y) / 2,
      (v1.z + v2.z) / 2
    )

    return newId
  }

  /** Flip an edge (rotate between two triangles) */
  flipEdge(id) {
    const he = this.halfEdges.get(id)
    if (!he) return
    if (he.twin === null || he.twin === undefined) return

    const face1 = he.face
    const face2 = he.twin

    const v1 = he.vertex
    const f1Next = this.halfEdges.get(he.next)
    const v2 = f1Next ? f1Next.vertex : null
    const f1Prev = he.prev
    const v3 = f1Prev ? this.halfEdges.get(f1Prev).vertex : null

    const twin = this.halfEdges.get(he.twin)
    const t2Next = twin ? this.halfEdges.get(twin.next) : null
    const v4 = t2Next ? t2Next.vertex : null

    if (!v2 || !v3 || !v4 || v2 === v3 || v3 === v4) return

    this.deleteFace(face1)
    this.deleteFace(face2)
    this.addFace([v3, v1, v4])
    this.addFace([v3, v4, v2])
  }

  /** Loop cut through a face */
  loopCut(faceId, edgeIndex, cuts) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length < 3 || cuts < 1) return []

    const newVerts = []
    for (let i = 0; i < verts.length; i++) {
      const next = (i + 1) % verts.length
      const v1 = this.vertices.get(verts[i])
      const v2 = this.vertices.get(verts[next])
      const t = (edgeIndex !== undefined && i === edgeIndex) ? 0.5 : 0
      if (t > 0) {
        const nv = this.addVertex(
          v1.x + (v2.x - v1.x) * t,
          v1.y + (v2.y - v1.y) * t,
          v1.z + (v2.z - v1.z) * t
        )
        newVerts.push(nv)
      } else {
        newVerts.push(verts[i])
      }
    }

    if (newVerts.length >= 3) {
      this.deleteFace(faceId)
      this.addFace(newVerts)
    }

    return newVerts
  }

  /** Weld vertices within tolerance */
  weldVertices(ids, tol = 0.001) {
    if (ids.length < 2) return
    const target = ids[0]
    const tv = this.vertices.get(target)
    if (!tv) return

    for (let i = 1; i < ids.length; i++) {
      const v = this.vertices.get(ids[i])
      if (!v) continue
      const dx = v.x - tv.x, dy = v.y - tv.y, dz = v.z - tv.z
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < tol) {
        // Replace references from ids[i] to target
        this._replaceVertexRefs(ids[i], target)
        this.vertices.delete(ids[i])
      }
    }
    this.cleanOrphans()
  }

  /** Bridge two loops (edge loops) */
  bridgeLoops(loopA, loopB) {
    if (loopA.length !== loopB.length || loopA.length < 2) return

    for (let i = 0; i < loopA.length; i++) {
      const next = (i + 1) % loopA.length
      this.addFace([loopA[i], loopA[next], loopB[next], loopB[i]])
    }
  }

  /** Triangulate all faces (fan triangulation) */
  triangulate() {
    const faceIds = [...this.faces.keys()]
    const newFaces = []

    for (const faceId of faceIds) {
      const verts = this.getFaceVertices(faceId)
      if (verts.length <= 3) continue

      this.deleteFace(faceId)

      // Fan triangulation
      for (let i = 1; i < verts.length - 1; i++) {
        const newFaceId = this.addFace([verts[0], verts[i], verts[i + 1]])
        if (newFaceId) newFaces.push(newFaceId)
      }
    }

    return newFaces
  }

  /** Fill a boundary (hole) defined by ordered vertex IDs */
  fillBoundaryFace(vertexIds) {
    if (vertexIds.length < 3) return null
    return this.addFace(vertexIds)
  }

  /** Get boundary loops (faces that have un-twin half-edges) */
  getBoundaryLoops() {
    const boundaryHalfEdges = []
    for (const [id, he] of this.halfEdges) {
      if (he.twin === null || he.twin === undefined) {
        boundaryHalfEdges.push(id)
      }
    }

    const loops = []
    const used = new Set()

    for (const startHe of boundaryHalfEdges) {
      if (used.has(startHe)) continue

      const loop = []
      let current = startHe
      const visited = new Set()

      while (current !== undefined && current !== null && !visited.has(current)) {
        visited.add(current)
        used.add(current)
        const he = this.halfEdges.get(current)
        if (!he) break
        loop.push(he.vertex)

        // Walk along boundary (un-twin edges): go to prev to get next boundary edge
        const prevHe = this.halfEdges.get(he.prev)
        if (!prevHe) break
        current = prevHe.twin

        if (current === startHe) break
        if (current === null || current === undefined) break
      }

      if (loop.length >= 3) {
        loops.push(loop)
      }
    }

    return loops
  }

  /** Clean orphaned half-edges (no face) */
  cleanOrphans() {
    const toDelete = []
    for (const [id, he] of this.halfEdges) {
      if (he.face === null || he.face === undefined || !this.faces.has(he.face)) {
        if (he.twin !== null && he.twin !== undefined) {
          const twin = this.halfEdges.get(he.twin)
          if (twin) twin.twin = null
        }
        toDelete.push(id)
      }
    }
    for (const id of toDelete) {
      this.halfEdges.delete(id)
    }

    // Clean up vertexToHalfEdge
    for (const [vid, heId] of this.vertexToHalfEdge) {
      if (!this.halfEdges.has(heId)) {
        this.vertexToHalfEdge.delete(vid)
      }
    }
  }

  /** Collapse an edge into a single vertex */
  collapseEdge(id) {
    const he = this.halfEdges.get(id)
    if (!he) return

    const nextHe = this.halfEdges.get(he.next)
    if (!nextHe) return

    const v1 = he.vertex
    const v2 = nextHe.vertex
    const v1Data = this.vertices.get(v1)
    const v2Data = this.vertices.get(v2)

    // Move v1 to midpoint
    this.setVertex(v1,
      (v1Data.x + v2Data.x) / 2,
      (v1Data.y + v2Data.y) / 2,
      (v1Data.z + v2Data.z) / 2
    )

    // Replace all v2 references with v1
    this._replaceVertexRefs(v2, v1)
    this.vertices.delete(v2)
    this.cleanOrphans()
  }

  /** Collapse a vertex into its neighbor */
  collapseVertex(id) {
    const heId = this.vertexToHalfEdge.get(id)
    if (heId === undefined) return

    const he = this.halfEdges.get(heId)
    if (!he) return

    const neighborId = this.halfEdges.get(he.next)?.vertex
    if (neighborId === undefined || neighborId === id) return

    this._replaceVertexRefs(id, neighborId)
    this.vertices.delete(id)
    this.vertexToHalfEdge.delete(id)
    this.vertexUVs.delete(id)
    this.cleanOrphans()
  }

  /** Dissolve an edge (merge two faces on either side) */
  dissolveEdge(id) {
    const he = this.halfEdges.get(id)
    if (!he) return
    if (he.twin === null || he.twin === undefined) return

    const face1Id = he.face
    const face2Id = he.twin
    if (face1Id === face2Id) return

    const verts1 = this.getFaceVertices(face1Id)
    const verts2 = this.getFaceVertices(face2Id)

    this.deleteFace(face1Id)
    this.deleteFace(face2Id)

    // Merge vertex lists, removing the shared edge vertices at boundary
    const merged = [...verts1]
    // Find shared vertices and merge properly
    const shared = []
    for (const v of verts2) {
      if (!verts1.includes(v)) {
        merged.push(v)
      } else {
        shared.push(v)
      }
    }

    if (merged.length >= 3) {
      this.addFace(merged)
    }
  }

  /** Flip a face's winding order (normal direction) */
  flipFaceNormal(faceId) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length < 3) return

    this.deleteFace(faceId)
    this.addFace([...verts].reverse())
  }

  /** Replace all references to oldVertexId with newVertexId in half-edges */
  _replaceVertexRefs(oldId, newId) {
    for (const [, he] of this.halfEdges) {
      if (he.vertex === oldId) he.vertex = newId
    }
    // Update vertexToHalfEdge
    if (this.vertexToHalfEdge.get(oldId) !== undefined) {
      if (!this.vertexToHalfEdge.has(newId)) {
        this.vertexToHalfEdge.set(newId, this.vertexToHalfEdge.get(oldId))
      }
      this.vertexToHalfEdge.delete(oldId)
    }
  }

  /** Replace face vertices (delete and recreate face) */
  _replaceFaceVertices(faceId, newVerts) {
    this.deleteFace(faceId)
    this.addFace(newVerts)
    // The new face will get a new ID, so we need to re-map
    // Find the latest face and update references
    const latestFaceId = this._nextFaceId - 1
    if (this.faces.has(latestFaceId)) {
      // Copy to original faceId
      this.faces.set(faceId, this.faces.get(latestFaceId))
      this.faces.delete(latestFaceId)
      // Update half-edge face references
      const face = this.faces.get(faceId)
      let current = face.halfEdge
      const visited = new Set()
      while (current !== undefined && current !== null && !visited.has(current)) {
        visited.add(current)
        const he = this.halfEdges.get(current)
        if (he) he.face = faceId
        current = he?.next
        if (current === face.halfEdge) break
      }
    }
  }

  _computeFaceNormal(faceId) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length < 3) return { x: 0, y: 1, z: 0 }

    const a = this.vertices.get(verts[0])
    const b = this.vertices.get(verts[1])
    const c = this.vertices.get(verts[2])

    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z

    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1

    return { x: nx / len, y: ny / len, z: nz / len }
  }

  _computeFaceCenter(faceId) {
    const verts = this.getFaceVertices(faceId)
    if (verts.length === 0) return { x: 0, y: 0, z: 0 }

    let cx = 0, cy = 0, cz = 0
    for (const vid of verts) {
      const v = this.vertices.get(vid)
      cx += v.x; cy += v.y; cz += v.z
    }
    const n = verts.length
    return { x: cx / n, y: cy / n, z: cz / n }
  }

  /** Static factory: create HalfEdgeMesh from a Babylon.js mesh */
  static fromBabylonMesh(mesh) {
    const heMesh = new HalfEdgeMesh()

    const positions = mesh.getVerticesData('position')
    const indices = mesh.getIndices()
    const uvs = mesh.getVerticesData('uv')

    if (!positions || !indices) return heMesh

    // Add vertices
    for (let i = 0; i < positions.length; i += 3) {
      const uv = uvs ? { u: uvs[i], v: uvs[i + 1] } : null
      heMesh.addVertex(positions[i], positions[i + 1], positions[i + 2], uv)
    }

    // Add faces (triangles)
    for (let i = 0; i < indices.length; i += 3) {
      heMesh.addFace([indices[i], indices[i + 1], indices[i + 2]])
    }

    return heMesh
  }

  /** Deep clone */
  clone() {
    const cloned = new HalfEdgeMesh()
    cloned._nextHalfEdgeId = this._nextHalfEdgeId
    cloned._nextFaceId = this._nextFaceId
    cloned._highestVertexId = this._highestVertexId

    for (const [id, v] of this.vertices) {
      cloned.vertices.set(id, { ...v })
    }
    for (const [id, he] of this.halfEdges) {
      cloned.halfEdges.set(id, { ...he })
    }
    for (const [id, f] of this.faces) {
      cloned.faces.set(id, { ...f })
    }
    for (const [id, uv] of this.vertexUVs) {
      cloned.vertexUVs.set(id, { ...uv })
    }
    for (const [id, heId] of this.vertexToHalfEdge) {
      cloned.vertexToHalfEdge.set(id, heId)
    }

    return cloned
  }

  /** Serialize to JSON */
  toJSON() {
    return {
      vertices: [...this.vertices.entries()],
      halfEdges: [...this.halfEdges.entries()],
      faces: [...this.faces.entries()],
      vertexToHalfEdge: [...this.vertexToHalfEdge.entries()],
      vertexUVs: [...this.vertexUVs.entries()],
      _nextHalfEdgeId: this._nextHalfEdgeId,
      _nextFaceId: this._nextFaceId,
      _highestVertexId: this._highestVertexId
    }
  }
}

export default HalfEdgeMesh