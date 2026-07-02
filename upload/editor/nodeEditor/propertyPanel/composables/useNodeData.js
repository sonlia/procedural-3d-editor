import { computed } from "vue";

/**
 * 统一的节点数据访问接口
 * 解决不同面板访问数据路径不一致的问题
 */
export function useNodeData(nodeData) {
  // 安全的属性访问函数
  const safePropertyAccess = (path, defaultValue = null) => {
    try {
      return (
        path.split(".").reduce((obj, key) => obj?.[key], nodeData.value) ??
        defaultValue
      );
    } catch (error) {
      console.warn(`Property access failed for path: ${path}`, error);
      return defaultValue;
    }
  };

  // 确保属性结构存在
  const ensurePropertyStructure = (type, key = null, defaultValue = null) => {
    if (!nodeData.value) return;

    // 确保 properties 对象存在
    if (!nodeData.value.properties) {
      nodeData.value.properties = {};
    }

    // 确保指定类型的属性存在
    if (!nodeData.value.properties[type]) {
      nodeData.value.properties[type] = {};
    }

    // 如果指定了 key，确保该 key 存在
    if (key && !nodeData.value.properties[type][key]) {
      nodeData.value.properties[type][key] = defaultValue;
    }
  };

  // 统一的数据访问计算属性
  const nodeDefinition = computed(() => safePropertyAccess("nodeRawData", {}));
  const nodeProperties = computed(() => safePropertyAccess("properties", {}));

  // 各类型数据的访问器
  const propsDefinition = computed(() => nodeDefinition.value.props || {});
  const eventsDefinition = computed(() => nodeDefinition.value.events || {});
  const slotsDefinition = computed(() => nodeDefinition.value.slots || {});
  const methodsDefinition = computed(() => nodeDefinition.value.methods || {});
  const computedPropsDefinition = computed(() => nodeDefinition.value.computedProps || {});

  const propsProperties = computed(() => nodeProperties.value.props || {});
  const eventsProperties = computed(() => nodeProperties.value.events || {});
  const slotsProperties = computed(() => nodeProperties.value.slots || {});
  const methodsProperties = computed(() => nodeProperties.value.methods || {});
  const computedPropsProperties = computed(() => nodeProperties.value.computedProps || {});
  const styleProperties = computed(() => nodeProperties.value.styleClass || {});

  return {
    // 数据访问
    nodeDefinition,
    nodeProperties,

    // 分类数据访问
    propsDefinition,
    eventsDefinition,
    slotsDefinition,
    methodsDefinition,
    computedPropsDefinition,

    propsProperties,
    eventsProperties,
    slotsProperties,
    methodsProperties,
    computedPropsProperties,
    styleProperties,

    // 工具方法
    safePropertyAccess,
    ensurePropertyStructure,

    // 便捷访问方法
    getDefinition: (type) => nodeDefinition.value[type] || {},
    getProperties: (type) => nodeProperties.value[type] || {},
    hasDefinition: (type) =>
      !!(
        nodeDefinition.value[type] &&
        Object.keys(nodeDefinition.value[type]).length > 0
      ),
    hasProperties: (type) =>
      !!(
        nodeProperties.value[type] &&
        Object.keys(nodeProperties.value[type]).length > 0
      ),
  };
}
