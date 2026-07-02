import { defineAsyncComponent } from 'vue';

/**
 * 通用异步组件创建工具
 * @param {Function} importFn - 导入函数
 * @param {string} componentName - 组件名称（用于日志）
 * @param {Object} options - 配置选项
 * @returns {Component} 异步组件
 */
export function createAsyncComponent(importFn, componentName = 'Component', options = {}) {
  const {
    delay = 200,
    timeout = 3000,
    onError = null,
    loadingComponent = null,
    errorComponent = null
  } = options;

  return defineAsyncComponent({
    loader: importFn,
    loadingComponent,
    errorComponent,
    delay,
    timeout,
    onError: (error, retry, fail, attempts) => {
      console.error(`Failed to load component ${componentName} (attempt ${attempts}):`, error);
      onError?.(componentName, error, retry, fail, attempts);
      fail(); // 默认失败，不自动重试
    }
  });
}

/**
 * 批量创建异步组件映射
 * @param {Object} importMap - 导入函数映射对象 { componentName: importFn }
 * @param {Object} options - 配置选项
 * @returns {Object} 异步组件映射对象
 */
export function createAsyncComponentMap(importMap, options = {}) {
  return Object.entries(importMap).reduce((map, [key, importFn]) => {
    map[key] = createAsyncComponent(importFn, key, options);
    return map;
  }, {});
}

/**
 * 属性编辑器组件导入映射
 */
const PROPERTY_EDITOR_IMPORTS = {
  toggleItem: () => import('./toggleItem.vue'),
  inputItem: () => import('./inputItem.vue'),
  htmlEditorItem: () => import('./htmlEditorItem.vue'),
  colorItem: () => import('./colorItem.vue'),
  iconItem: () => import('./iconItem.vue'),
  sizeItem: () => import('./sizeItem.vue'),
  dropDownSelect: () => import('./dropDownSelect.vue')
};

/**
 * 获取属性编辑器组件映射
 * @param {Object} options - 配置选项
 * @returns {Object} 组件映射对象
 */
export function getPropertyEditorComponents(options = {}) {
  return createAsyncComponentMap(PROPERTY_EDITOR_IMPORTS, options);
}

// 导出组件导入映射供外部使用
export { PROPERTY_EDITOR_IMPORTS };
