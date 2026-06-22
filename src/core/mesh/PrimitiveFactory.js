/**
 * 基础几何体工厂 - PrimitiveFactory (Babylon.js)
 * 生成标准参数化几何体，附带参数元数据
 */
import {
  MeshBuilder, Color3,
  PBRMetallicRoughnessMaterial, StandardMaterial, Mesh
} from '@babylonjs/core'
import sceneManager from '../scene/SceneManager.js'

class PrimitiveFactory {
  /** 所有支持的几何体类型 */
  static TYPES = ['box', 'sphere', 'cylinder', 'cone', 'plane', 'torus', 'monkey', 'icosphere', 'capsule']

  /** 默认参数元数据 */
  static METADATA = {
    box:       { label: 'Cube',       icon: 'check_box_outline_blank', params: { width: 1, height: 1, depth: 1 } },
    sphere:    { label: 'UV Sphere',   icon: 'circle',                 params: { radius: 0.5, widthSegments: 32, heightSegments: 32 } },
    cylinder:  { label: 'Cylinder',   icon: 'view_column',            params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, segments: 32 } },
    cone:      { label: 'Cone',       icon: 'change_history',          params: { radius: 0.5, height: 1, segments: 32 } },
    plane:     { label: 'Plane',      icon: 'crop_square',            params: { width: 2, height: 2 } },
    torus:     { label: 'Torus',      icon: 'panorama_fish_eye',      params: { radius: 0.5, tube: 0.2, radialSegments: 16, tubularSegments: 32 } },
    monkey:    { label: 'Suzanne',    icon: 'pets',                    params: { radius: 0.5, detail: 1 } },
    icosphere: { label: 'Ico Sphere', icon: 'circle',                 params: { radius: 0.5, subdivisions: 2 } },
    capsule:   { label: 'Capsule',    icon: 'capsule',                 params: { radius: 0.3, length: 1, capSegments: 16, radialSegments: 16 } }
  }

  /** 创建默认 PBR 材质 */
  static createDefaultMaterial(type, scene) {
    if (!scene) scene = sceneManager.scene
    if (!scene) return null

    const colors = {
      box: [0.33, 0.32, 0.93], sphere: [0.20, 0.60, 0.94], cylinder: [0.99, 0.77, 0.10],
      cone: [1.0, 0.42, 0.42], plane: [0.32, 0.81, 0.40], torus: [0.80, 0.36, 0.91],
      monkey: [1.0, 0.57, 0.17], icosphere: [0.13, 0.72, 0.81], capsule: [0.88, 0.88, 0.94]
    }
    const c = colors[type] || [0.33, 0.32, 0.93]

    const mat = new PBRMetallicRoughnessMaterial(`mat_${type}_${Date.now()}`, scene)
    mat.baseColor = new Color3(c[0], c[1], c[2])
    mat.metallic = 0.3
    mat.roughness = 0.4
    return mat
  }

  /** 创建几何体 Mesh */
  static createMesh(type, params = {}, namePrefix) {
    const scene = sceneManager.scene
    if (!scene) return null

    const p = { ...(PrimitiveFactory.METADATA[type]?.params || {}), ...params }
    const name = (namePrefix || type) + '_' + Date.now()
    let mesh

    switch (type) {
      case 'box':
        mesh = MeshBuilder.CreateBox(name, { width: p.width, height: p.height, depth: p.depth }, scene)
        break
      case 'sphere':
        mesh = MeshBuilder.CreateSphere(name, { diameter: p.radius * 2, segments: p.widthSegments }, scene)
        break
      case 'cylinder':
        mesh = MeshBuilder.CreateCylinder(name, {
          diameterTop: p.radiusTop * 2,
          diameterBottom: p.radiusBottom * 2,
          height: p.height,
          tessellation: p.segments
        }, scene)
        break
      case 'cone':
        mesh = MeshBuilder.CreateCylinder(name, {
          diameterTop: 0,
          diameterBottom: p.radius * 2,
          height: p.height,
          tessellation: p.segments
        }, scene)
        break
      case 'plane':
        mesh = MeshBuilder.CreateGround(name, { width: p.width, height: p.height }, scene)
        break
      case 'torus':
        mesh = MeshBuilder.CreateTorus(name, {
          diameter: p.radius * 2,
          thickness: p.tube * 2,
          tessellation: p.radialSegments
        }, scene)
        break
      case 'monkey':
        // Babylon.js 没有内置 Suzanne，用十二面体代替
        mesh = MeshBuilder.CreatePolyhedron(name, { type: 2, size: p.radius }, scene)
        break
      case 'icosphere':
        // 用 二十面体代替
        mesh = MeshBuilder.CreatePolyhedron(name, { type: 3, size: p.radius }, scene)
        break
      case 'capsule':
        mesh = MeshBuilder.CreateCapsule(name, {
          height: p.length + p.radius * 2,
          radius: p.radius
        }, scene)
        break
      default:
        mesh = MeshBuilder.CreateBox(name, { width: 1, height: 1, depth: 1 }, scene)
    }

    // 设置默认材质
    mesh.material = PrimitiveFactory.createDefaultMaterial(type, scene)

    // 阴影
    if (sceneManager._shadowGenerator) {
      sceneManager._shadowGenerator.addShadowCaster(mesh)
    }
    mesh.receiveShadows = true

    return mesh
  }

  /** 创建 display_panel 类型 mesh（平面 + 半透明材质） */
  static createDisplayPanelMesh(name, scene) {
    if (!scene) scene = sceneManager.scene
    if (!scene) return null

    const mesh = MeshBuilder.CreatePlane(name || 'display_panel_' + Date.now(), {
      width: 1.2, height: 0.8
    }, scene)
    const mat = new StandardMaterial('panelMat_' + Date.now(), scene)
    mat.diffuseColor = new Color3(0.16, 0.16, 0.35)
    mat.emissiveColor = new Color3(0.08, 0.08, 0.2)
    mat.alpha = 0.85
    mat.backFaceCulling = false
    mesh.material = mat
    mesh.isPickable = true
    return mesh
  }

  /** 创建灯光指示器 mesh（小球体） */
  static createLightIndicator(lightType, name, scene) {
    if (!scene) scene = sceneManager.scene
    if (!scene) return null

    const mesh = MeshBuilder.CreateSphere(name || 'lightIndicator_' + Date.now(), {
      diameter: 0.3
    }, scene)
    const mat = new StandardMaterial('lightMat_' + Date.now(), scene)
    const lightColors = {
      point: [1, 0.87, 0.27],
      directional: [1, 1, 1],
      spot: [0.53, 0.67, 1]
    }
    const c = lightColors[lightType] || [1, 0.87, 0.27]
    mat.diffuseColor = new Color3(c[0], c[1], c[2])
    mat.emissiveColor = new Color3(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5)
    mesh.material = mat
    mesh.isPickable = true
    return mesh
  }
}

export default PrimitiveFactory
