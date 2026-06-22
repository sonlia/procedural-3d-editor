/**
 * CSG Boolean and Merge operations
 */
import { CSG } from '@babylonjs/core/Meshes/csg'
import { Mesh, VertexBuffer, VertexData } from '@babylonjs/core'
import emitter, { MESH_EVENTS } from '../../core/eventBus.js'

/**
 * Perform a CSG boolean operation between two Babylon.js meshes
 * @param {Mesh} meshA - First mesh (material is transferred to result)
 * @param {Mesh} meshB - Second mesh
 * @param {'union'|'subtract'|'intersect'} operation
 * @returns {Mesh|null} Result mesh
 */
export function booleanCSG(meshA, meshB, operation) {
  if (!meshA || !meshB) return null

  try {
    const csgA = CSG.FromMesh(meshA)
    const csgB = CSG.FromMesh(meshB)

    let resultCSG
    switch (operation) {
      case 'union':
        resultCSG = csgA.union(csgB)
        break
      case 'subtract':
        resultCSG = csgA.subtract(csgB)
        break
      case 'intersect':
        resultCSG = csgA.intersect(csgB)
        break
      default:
        console.warn('[mesh-boolean] Unknown operation:', operation)
        return null
    }

    const resultMesh = resultCSG.toMesh(`csg_${operation}_${Date.now()}`, null, meshA.getScene())

    // Transfer material from meshA
    if (meshA.material) {
      resultMesh.material = meshA.material
    }

    // Copy metadata
    if (meshA.metadata) {
      resultMesh.metadata = { ...meshA.metadata }
    }

    resultMesh.position = meshA.position.clone()
    resultMesh.rotation = meshA.rotation.clone()
    resultMesh.scaling = meshA.scaling.clone()

    // Cleanup CSG
    csgA.dispose()
    csgB.dispose()
    resultCSG.dispose()

    emitter.emit(MESH_EVENTS.MESH_BOOLEAN_PERFORMED, { operation, result: resultMesh })
    return resultMesh
  } catch (err) {
    console.error('[mesh-boolean] CSG operation failed:', err)
    return null
  }
}

/**
 * Merge two meshes into one by combining vertex/index data
 * @param {Mesh} meshA
 * @param {Mesh} meshB
 * @returns {Mesh|null}
 */
export function mergeMeshes(meshA, meshB) {
  if (!meshA || !meshB) return null

  try {
    const scene = meshA.getScene()
    const name = `merged_${Date.now()}`

    const posA = meshA.getVerticesData('position') || new Float32Array(0)
    const posB = meshB.getVerticesData('position') || new Float32Array(0)
    const idxA = meshA.getIndices() || []
    const idxB = meshB.getIndices() || []
    const normA = meshA.getVerticesData('normal') || new Float32Array(0)
    const normB = meshB.getVerticesData('normal') || new Float32Array(0)
    const uvA = meshA.getVerticesData('uv') || new Float32Array(0)
    const uvB = meshB.getVerticesData('uv') || new Float32Array(0)

    const vertCountA = posA.length / 3
    const vertCountB = posB.length / 3

    // Merge positions
    const mergedPos = new Float32Array(posA.length + posB.length)
    mergedPos.set(posA, 0)
    // Offset meshB positions by meshA's world position difference
    const offsetA = meshA.getAbsolutePosition()
    const offsetB = meshB.getAbsolutePosition()
    const worldOffset = offsetB.subtract(offsetA)
    for (let i = 0; i < posB.length; i += 3) {
      mergedPos[posA.length + i] = posB[i] + worldOffset.x
      mergedPos[posA.length + i + 1] = posB[i + 1] + worldOffset.y
      mergedPos[posA.length + i + 2] = posB[i + 2] + worldOffset.z
    }

    // Merge indices (offset meshB indices)
    const mergedIdx = new Uint16Array(idxA.length + idxB.length)
    mergedIdx.set(idxA, 0)
    for (let i = 0; i < idxB.length; i++) {
      mergedIdx[idxA.length + i] = idxB[i] + vertCountA
    }

    // Merge normals
    let mergedNorm = null
    if (normA.length > 0 || normB.length > 0) {
      mergedNorm = new Float32Array(normA.length + normB.length)
      if (normA.length > 0) mergedNorm.set(normA, 0)
      if (normB.length > 0) mergedNorm.set(normB, normA.length)
    }

    // Merge UVs
    let mergedUV = null
    if (uvA.length > 0 || uvB.length > 0) {
      mergedUV = new Float32Array(uvA.length + uvB.length)
      if (uvA.length > 0) mergedUV.set(uvA, 0)
      if (uvB.length > 0) mergedUV.set(uvB, uvA.length)
    }

    // Create result mesh using VertexData
    const resultMesh = new Mesh(name, scene)
    const vd = new VertexData()
    vd.positions = mergedPos
    vd.indices = Array.from(mergedIdx)
    if (mergedNorm) vd.normals = mergedNorm
    if (mergedUV) vd.uvs = mergedUV
    vd.applyToMesh(resultMesh)

    // Use meshB's material
    if (meshB.material) {
      resultMesh.material = meshB.material
    } else if (meshA.material) {
      resultMesh.material = meshA.material
    }

    resultMesh.position = meshA.position.clone()

    emitter.emit(MESH_EVENTS.MESH_CHANGED, { mesh: resultMesh })
    return resultMesh
  } catch (err) {
    console.error('[mesh-boolean] Merge failed:', err)
    return null
  }
}