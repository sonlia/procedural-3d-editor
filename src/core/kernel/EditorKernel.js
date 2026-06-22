/**
 * Procedural3D Editor - Kernel Module
 * 微内核架构：统一模块注册、生命周期管理、插件加载
 */
import emitter from '../eventBus.js'

class EditorKernel {
  constructor() {
    this.modules = new Map()
    this.plugins = new Map()
    this.initialized = false
    this._destroyFns = new Map()
  }

  /**
   * 注册核心模块（单例，不可重复）
   * @param {string} name - 模块名
   * @param {object} module - 模块实例，需实现 init()/destroy() 接口
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`[Kernel] Module "${name}" already registered, skipping.`)
      return
    }
    this.modules.set(name, module)
    module._kernel = this
  }

  /**
   * 注册插件（可热插拔）
   * @param {string} name - 插件名
   * @param {object} plugin - 插件实例
   */
  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin)
    plugin._kernel = this
  }

  /**
   * 获取已注册模块
   */
  getModule(name) {
    return this.modules.get(name)
  }

  /**
   * 获取已注册插件
   */
  getPlugin(name) {
    return this.plugins.get(name)
  }

  /**
   * 初始化所有模块（按注册顺序）
   */
  async init() {
    if (this.initialized) return
    console.log('[Kernel] Initializing modules...')

    for (const [name, mod] of this.modules) {
      try {
        if (typeof mod.init === 'function') {
          await mod.init()
        }
        console.log(`[Kernel] Module "${name}" initialized.`)
      } catch (err) {
        console.error(`[Kernel] Failed to init module "${name}":`, err)
      }
    }

    // 初始化插件
    for (const [name, plugin] of this.plugins) {
      try {
        if (typeof plugin.init === 'function') {
          await plugin.init()
        }
        console.log(`[Kernel] Plugin "${name}" initialized.`)
      } catch (err) {
        console.error(`[Kernel] Failed to init plugin "${name}":`, err)
      }
    }

    this.initialized = true
    emitter.emit('kernel:initialized')
  }

  /**
   * 销毁所有模块（逆序）
   */
  async destroy() {
    for (const [name, plugin] of [...this.plugins].reverse()) {
      try {
        if (typeof plugin.destroy === 'function') await plugin.destroy()
      } catch (err) {
        console.error(`[Kernel] Failed to destroy plugin "${name}":`, err)
      }
    }
    for (const [name, mod] of [...this.modules].reverse()) {
      try {
        if (typeof mod.destroy === 'function') await mod.destroy()
      } catch (err) {
        console.error(`[Kernel] Failed to destroy module "${name}":`, err)
      }
    }
    this.modules.clear()
    this.plugins.clear()
    this.initialized = false
  }

  /**
   * 模块间通信：通过事件总线转发，带来源标记
   */
  emit(event, data, source) {
    emitter.emit(event, { ...data, _source: source })
  }

  on(event, handler) {
    emitter.on(event, handler)
  }

  off(event, handler) {
    emitter.off(event, handler)
  }
}

// 全局单例
const kernel = new EditorKernel()
export default kernel
export { EditorKernel }
