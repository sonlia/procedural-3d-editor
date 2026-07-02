<script setup>
import { ref, onMounted, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// === 数据模型定义 ===
const defaultProperties = () => ({
  // 顶部导出控制
  exported: false,           // exp checkbox
  enableDeclaration: false,  // 启用声明控制（slot模式）
  declareType: 'let',        // 声明类型（固定为let）
  outputVar: `arry_${uid().slice(0, 8)}`,      // 输出变量名
  varNameSlotId: uid(),      // 变量名 slot ID

  // 统一操作模式 - 可以是属性或方法或索引访问
  sourceParam: createParam('[1,2,3]'), // 源数组参数
  methods: [],               // 方法/属性/索引链数组

  remark: ''                 // 备注
});

// === 单一数据源模式 ===
// 纯计算属性 - 无副作用
const properties = computed(() => props.value?.properties || {});

// 专门的初始化函数
function ensureProperties() {

  // 检查 props.value.properties 是否"有数据"
  const hasPropertiesData = props.value?.properties &&
    typeof props.value.properties === 'object' &&
    !Array.isArray(props.value.properties) &&
    Object.keys(props.value.properties).length > 0;

  if (!hasPropertiesData) {
    // 如果没有数据，则重新初始化
    props.value.properties = defaultProperties();
  }

  // 确保 sourceParam 始终存在
  if (!props.value.properties.sourceParam) {
    props.value.properties.sourceParam = createParam('[]');
  }

  // 确保 varNameSlotId 存在
  if (!props.value.properties.varNameSlotId) {
    props.value.properties.varNameSlotId = uid();
  }
}

onMounted(() => {
  ensureProperties();
});

// === 方法映射定义 ===
const hasReturnValue = { hasReturnValue: true };
const noReturnValue = { hasReturnValue: false };

// Instance方法映射 (基于MDN/W3School API)
const instanceMethodMap = {
  // 修改原数组
  push: { params: ['...'], description: '向数组末尾添加一个或多个元素，并返回新长度。', variadic: true, variadicLabel: 'element', ...hasReturnValue },
  pop: { params: [], description: '删除数组的最后一个元素并返回该元素。', ...hasReturnValue },
  shift: { params: [], description: '删除数组的第一个元素并返回该元素。', ...hasReturnValue },
  unshift: { params: ['...'], description: '向数组的开头添加一个或多个元素，并返回新长度。', variadic: true, variadicLabel: 'element', ...hasReturnValue },
  splice: { params: ['index', 'deleteCount', '...'], description: '向/从数组中添加/删除项目，然后返回被删除的项目。', variadic: true, variadicLabel: 'item', ...hasReturnValue },
  sort: { params: ['sort(a, b)'], description: '对数组的元素进行排序。', ...hasReturnValue },
  reverse: { params: [], description: '反转数组的元素顺序。', ...hasReturnValue },
  fill: { params: ['value', 'start', 'end'], description: '用一个固定值填充一个数组中从起始索引到终止索引内的全部元素。', ...hasReturnValue },
  copyWithin: { params: ['target', 'start', 'end'], description: '浅复制数组的一部分到同一数组中的另一个位置，并返回它，不会改变原数组的长度。', ...hasReturnValue },
  // 返回新数组
  slice: { params: ['start', 'end'], description: '从已有数组中返回选定的元素。', ...hasReturnValue },
  concat: { params: ['...'], description: '连接两个或更多的数组，并返回结果。', variadic: true, variadicLabel: 'array', ...hasReturnValue },
  map: { params: ['map(currentValue, index, array)'], description: '创建新数组，其中每一个元素由调用数组中的每一个元素执行提供的函数得来。', ...hasReturnValue },
  filter: { params: ['filter(element, index, array)'], description: '创建一个新数组, 其包含通过所提供函数实现的测试的所有元素。', ...hasReturnValue },
  reduce: { params: ['reduce(accumulator, currentValue, currentIndex, array)', 'initialValue'], description: '对数组中的每个元素执行一个reducer函数，将其结果汇总为单个返回值。', ...hasReturnValue },
  reduceRight: { params: ['reduceRight(accumulator, currentValue, currentIndex, array)', 'initialValue'], description: '接受一个函数作为累加器和数组的每个值（从右到左）将其减少为单个值。', ...hasReturnValue },
  flatMap: { params: ['flatMap(currentValue, index, array)'], description: '首先使用映射函数映射每个元素，然后将结果压缩成一个新数组。', ...hasReturnValue },
  // 查找
  indexOf: { params: ['searchElement', 'fromIndex'], description: '返回在数组中可以找到一个给定元素的第一个索引，如果不存在，则返回-1。', ...hasReturnValue },
  lastIndexOf: { params: ['searchElement', 'fromIndex'], description: '返回指定元素在数组中的最后一个的索引，如果不存在，则返回 -1。', ...hasReturnValue },
  includes: { params: ['valueToFind', 'fromIndex'], description: '判断一个数组是否包含一个指定的值，根据情况，如果包含则返回 true，否则返回false。', ...hasReturnValue },
  find: { params: ['find(element, index, array)'], description: '返回数组中满足提供的测试函数的第一个元素的值。否则返回 undefined。', ...hasReturnValue },
  findIndex: { params: ['findIndex(element, index, array)'], description: '返回数组中满足提供的测试函数的第一个元素的索引。若没有找到对应元素则返回-1。', ...hasReturnValue },
  findLast: { params: ['findLast(element, index, array)'], description: '返回数组中满足提供的测试函数条件的最后一个元素的值。如果没有找到对应元素，则返回 undefined。', ...hasReturnValue },
  findLastIndex: { params: ['findLastIndex(element, index, array)'], description: '返回数组中满足提供的测试函数条件的最后一个元素的索引。如果没有找到对应元素，则返回 -1。', ...hasReturnValue },
  // 迭代
  forEach: { params: ['forEach(currentValue, index, array)'], description: '对数组的每个元素执行一次提供的函数。', ...noReturnValue },
  every: { params: ['every(element, index, array)'], description: '测试数组的所有元素是否都通过了指定函数的测试。', ...hasReturnValue },
  some: { params: ['some(element, index, array)'], description: '测试数组中的某些元素是否通过由提供的函数实现的测试。', ...hasReturnValue },
  // 字符串转换
  join: { params: ['separator'], description: '将一个数组的所有元素连接成一个字符串并返回这个字符串。', ...hasReturnValue },
  toString: { params: [], description: '返回一个字符串，表示指定的数组及其元素。', ...hasReturnValue },
  toLocaleString: { params: ['locales', 'options'], description: '返回一个字符串表示数组中的元素。数组中的元素将使用各自的 toLocaleString 方法转成字符串。', ...hasReturnValue },
};

// Static方法映射
const staticMethodMap = {
  from: { params: ['arrayLike', 'map(element, index)'], description: '从类数组或可迭代对象创建一个新的数组实例', hasReturnValue: true },
  of: { params: ['...'], description: '创建一个具有可变数量参数的新数组实例', hasReturnValue: true, variadic: true, variadicLabel: 'element' },
  isArray: { params: ['obj'], description: '判断传递的值是否是一个Array', hasReturnValue: true }
};

// 统一的方法映射表（合并所有类型）
const allMethodsMap = {
  ...instanceMethodMap,
  ...staticMethodMap,
  length: { hasReturnValue: true, params: [], description: '数组的长度' }
};

// 统一的操作选项（属性 + 方法 + 索引访问）
const allOperationOptions = [
  // 索引访问（新增）
  { label: '[index]', value: '[index]', type: 'access', description: '通过索引访问数组元素 arr[0][1]' },

  // Instance属性
  { label: 'length', value: 'length', type: 'property', description: '数组的长度' },

  // Instance方法
  ...Object.keys(instanceMethodMap).map(m => ({
    label: m, value: m, type: 'method', description: instanceMethodMap[m].description
  })),

  // Static方法
  ...Object.keys(staticMethodMap).map(m => ({
    label: `Array.${m}`, value: m, type: 'static', description: staticMethodMap[m].description
  }))
];



// === 工具函数 ===
function createParam(label, isFunction = false) {

  return {
    label,
    id: uid(),
    isSlot: false,        // 始终默认为false
    value: label,
    isFunction: isFunctionParam(label)        // 是否为函数类型
  };
}

// === 统一更新函数 ===
const hoverIdx = ref(-1);

// 统一的画布更新触发器
function triggerUpdate() {
  props.value.onExecute?.();  // 触发代码重新生成
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateField(key, value) {
  set(properties.value, key, value);
  triggerUpdate();
}

// === 变量名 slot 管理 ===
function updateVarNameSlot(isSlot) {
  updateField('enableDeclaration', isSlot);
  const slotId = properties.value.varNameSlotId;
  const existingSlot = props.value.inputs.find(s => s.id === slotId);

  if (isSlot && !existingSlot) {
    // 添加变量名输入槽
    props.value.addInput('varName', 'string', { id: slotId });
  } else if (!isSlot && existingSlot) {
    // 删除变量名输入槽
    const index = props.value.inputs.indexOf(existingSlot);
    props.value.removeInput(index);
  }
  triggerUpdate();
}

// === 源数组 slot 管理 ===
function updateSourceSlot(isSlot) {
  const param = properties.value.sourceParam;
  if (!param) return;

  param.isSlot = isSlot;
  const existingSlot = props.value.inputs.find(s => s.id === param.id);

  if (isSlot && !existingSlot) {
    // 添加源数组输入槽，名称为 "value"
    props.value.addInput('value', 'string', { id: param.id });
  } else if (!isSlot && existingSlot) {
    const index = props.value.inputs.indexOf(existingSlot);
    props.value.removeInput(index);
  }
  triggerUpdate();
}

// 插槽动态管理核心函数（用于方法参数）
// prefix 格式为 "{methodIdx}-" (1-based)
function updateSlot(param, isSlot, prefix = '') {
  if (!param) {
    console.error('updateSlot: param is undefined');
    return;
  }
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);

  // 从 prefix 解析方法索引和方法名
  const methodIdx = prefix ? parseInt(prefix.replace('-', '')) - 1 : -1;
  const method = methodIdx >= 0 ? properties.value.methods[methodIdx] : null;
  const paramIdx = method?.params ? method.params.findIndex(p => p.id === param.id) : -1;

  // 构建 slot 名称: {methodName}-{paramIdx}
  let slotLabel;
  let slotType = 'string';
  let shape = undefined;
  let meta = undefined;

  if (isFunctionParam(param.label)) {
    const signature = parseFunctionSignature(param.label);
    // 函数参数: {methodName}-{paramIdx} 或回退到旧格式
    slotLabel = method ? `${method.methodName}-${paramIdx}` : `${prefix}${signature.name}`;
    slotType = 'function';
    shape = 5;
    meta = { isFunction: true, args: signature.args };
  } else {
    // 普通参数: {methodName}-{paramIdx}
    slotLabel = method ? `${method.methodName}-${paramIdx}` : `${prefix}${param.label}`;
    slotType = 'string';
  }

  if (isSlot && existingIdx === -1) {
    let insertPosition = props.value.inputs.length;

    if (method && paramIdx !== -1) {
      insertPosition = calculateSlotInsertPosition(methodIdx, paramIdx);
    }

    insertSlotAtPosition(slotLabel, slotType, { id: param.id, shape, meta }, insertPosition);
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  triggerUpdate();
}

// 获取方法/属性信息的统一函数
function getMethodInfo(methodName) {
  return allMethodsMap[methodName] || null;
}

// 统一的可变参数管理
function addVariadicParam(methodId) {
  const method = properties.value.methods.find(m => m.id === methodId);
  if (!method) return;

  const methodInfo = getMethodInfo(method.methodName);
  if (!methodInfo?.variadic) return;

  const currentCount = method.params.filter(p => p.label.startsWith(methodInfo.variadicLabel) || p.label === '...').length;
  const newLabel = `${methodInfo.variadicLabel}${currentCount}`;
  const newParam = createParam(newLabel);

  method.params.push(newParam);
  triggerUpdate();
}

function removeVariadicParam(methodId, paramId) {
  const method = properties.value.methods.find(m => m.id === methodId);
  if (!method) return;

  const paramIndex = method.params.findIndex(p => p.id === paramId);
  if (paramIndex === -1) return;

  const [removed] = method.params.splice(paramIndex, 1);
  if (removed?.isSlot) {
    const inputIndex = props.value.inputs.findIndex(i => i.id === removed.id);
    if (inputIndex !== -1) props.value.removeInput(inputIndex);
  }
  triggerUpdate();
}

function addMethodCard() {
  const firstMethod = '[index]'; // 默认添加索引访问
  const method = {
    id: uid(),
    methodName: firstMethod,
    params: [],
    // 索引访问专用字段
    accessChain: [{ id: uid(), isSlot: false, value: '0', slotId: uid() }]
  };

  if (properties.value.methods) {
    properties.value.methods.push(method);
  } else {
    properties.value.methods = [method];
  }

  triggerUpdate();
}

function onMethodChange(card, newMethod) {
  const oldMethod = card.methodName;
  card.methodName = newMethod;
  const oldParams = card.params || [];
  const methodInfo = getMethodInfo(newMethod);

  // 清理旧参数的 slot
  oldParams.forEach(oldParam => {
    if (oldParam.isSlot) {
      const inputIndex = props.value.inputs.findIndex(i => i.id === oldParam.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  // 如果旧方法是索引访问，清理索引链的 slots
  if (oldMethod === '[index]' && card.accessChain) {
    card.accessChain.forEach(item => {
      if (item.isSlot) {
        const inputIndex = props.value.inputs.findIndex(i => i.id === item.slotId);
        if (inputIndex !== -1) props.value.removeInput(inputIndex);
      }
    });
  }

  // 根据新方法类型初始化
  if (newMethod === '[index]') {
    // 索引访问：初始化 accessChain
    card.params = [];
    if (!card.accessChain || card.accessChain.length === 0) {
      card.accessChain = [{ id: uid(), isSlot: false, value: '0', slotId: uid() }];
    }
  } else if (newMethod === 'length') {
    // length 属性不需要参数
    card.params = [];
    card.accessChain = [];
  } else {
    // 普通方法：初始化参数
    card.accessChain = [];
    const newParams = (methodInfo?.params || [])
      .filter(l => l !== '...')
      .map(l => createParam(l));

    const methodIdx = properties.value.methods.findIndex(m => m.id === card.id);

    // 处理新参数
    newParams.forEach((newParam, paramIdx) => {
      if (isFunctionParam(newParam.label)) {
        newParam.isSlot = true;
        const insertPosition = calculateSlotInsertPosition(methodIdx, paramIdx);
        const signature = parseFunctionSignature(newParam.label);
        // slot 名称格式: {methodName}-{paramIdx}
        const slotLabel = `${newMethod}-${paramIdx}`;
        const slotType = 'function';
        const shape = 5;
        const meta = { isFunction: true, args: signature.args };
        insertSlotAtPosition(slotLabel, slotType, { id: newParam.id, shape, meta }, insertPosition);
      } else {
        newParam.isSlot = false;
      }
    });

    card.params = newParams;
  }

  updateMethodSlotsLabels();
  triggerUpdate();
}

// 智能更新所有方法slot的标签序号（基于ID，不删除重建）
function updateMethodSlotsLabels() {
  if (!properties.value.methods?.length) return;

  // 遍历所有方法，为每个方法的slot更新正确的名称
  properties.value.methods.forEach((method) => {
    // 更新方法参数的 slot 名称
    if (Array.isArray(method.params)) {
      method.params.forEach((param, paramIdx) => {
        if (!param.isSlot) return;

        const inputIdx = props.value.inputs.findIndex(input => input.id === param.id);
        if (inputIdx === -1) return;

        const input = props.value.inputs[inputIdx];
        // slot 名称格式: {methodName}-{paramIdx}
        const newSlotName = `${method.methodName}-${paramIdx}`;

        if (input.name !== newSlotName) {
          input.name = newSlotName;
        }
      });
    }

    // 更新索引访问的 slot 名称
    if (method.methodName === '[index]' && Array.isArray(method.accessChain)) {
      method.accessChain.forEach((item, accessIdx) => {
        if (!item.isSlot) return;

        const inputIdx = props.value.inputs.findIndex(input => input.id === item.slotId);
        if (inputIdx === -1) return;

        const input = props.value.inputs[inputIdx];
        // slot 名称格式: [index]-{accessIdx}
        const newSlotName = `[index]-${accessIdx}`;

        if (input.name !== newSlotName) {
          input.name = newSlotName;
        }
      });
    }
  });

  // 重新排列inputs顺序，确保与方法顺序一致
  reorderInputSlots();
}

// 计算某个参数应该插入的slot位置（在inputs数组中的索引）
function calculateSlotInsertPosition(methodIdx, paramIdx) {
  if (!properties.value.methods?.length) return props.value.inputs.length;

  let position = 0;

  // 首先跳过所有非方法参数的slot（如sourceArray）
  for (const input of props.value.inputs) {
    const isMethodParam = properties.value.methods.some(method =>
      method.params.some(param => param.id === input.id)
    );
    if (!isMethodParam) {
      position++;
    } else {
      break;
    }
  }

  // 然后计算在当前方法之前的所有slot数量
  for (let i = 0; i < methodIdx; i++) {
    const method = properties.value.methods[i];
    if (Array.isArray(method.params)) {
      position += method.params.filter(p => p.isSlot).length;
    }
  }

  // 最后加上当前方法中在当前参数之前的slot数量
  const currentMethod = properties.value.methods[methodIdx];
  if (Array.isArray(currentMethod.params) && paramIdx > 0) {
    for (let i = 0; i < paramIdx; i++) {
      if (currentMethod.params[i]?.isSlot) {
        position++;
      }
    }
  }

  return position;
}

// 在指定位置插入slot（替代直接使用addInput）
function insertSlotAtPosition(slotLabel, slotType, options = {}, position) {
  // 确保options中有id
  if (!options.id) {
    console.error('[insertSlotAtPosition] 错误: options中没有id!');
    return;
  }

  const newSlot = {
    name: slotLabel,
    type: slotType,
    link: null,
    id: options.id,  // 明确设置id
    shape: options.shape || undefined,
    meta: options.meta || undefined  // 函数 slot 的元数据
  };

  // 在指定位置插入
  props.value.inputs.splice(position, 0, newSlot);

  // 重新计算节点尺寸并触发图形更新
  props.value.setSize?.(props.value.computeSize?.());
  props.value.setDirtyCanvas?.(true, true);
}

// 重新排列input slots的顺序，使其与方法列表顺序一致
function reorderInputSlots() {
  if (!properties.value.methods?.length) return;

  const orderedSlots = [];
  const otherSlots = [];

  // 收集所有方法相关的 slot IDs
  const methodSlotIds = new Set();
  properties.value.methods.forEach(method => {
    // 方法参数的 slots
    if (Array.isArray(method.params)) {
      method.params.forEach(param => {
        if (param.isSlot) methodSlotIds.add(param.id);
      });
    }
    // 索引访问的 slots
    if (method.methodName === '[index]' && Array.isArray(method.accessChain)) {
      method.accessChain.forEach(item => {
        if (item.isSlot) methodSlotIds.add(item.slotId);
      });
    }
  });

  // 分离非方法参数的 slots（如 value, varName）
  props.value.inputs.forEach(input => {
    if (!methodSlotIds.has(input.id)) {
      otherSlots.push(input);
    }
  });

  // 按方法顺序添加方法参数和索引访问的 slots
  properties.value.methods.forEach(method => {
    // 方法参数的 slots
    if (Array.isArray(method.params)) {
      method.params.forEach(param => {
        if (param.isSlot) {
          const input = props.value.inputs.find(input => input.id === param.id);
          if (input) orderedSlots.push(input);
        }
      });
    }
    // 索引访问的 slots
    if (method.methodName === '[index]' && Array.isArray(method.accessChain)) {
      method.accessChain.forEach(item => {
        if (item.isSlot) {
          const input = props.value.inputs.find(input => input.id === item.slotId);
          if (input) orderedSlots.push(input);
        }
      });
    }
  });

  // 重建inputs数组（保持连接，只改变顺序）
  props.value.inputs = [...otherSlots, ...orderedSlots];
}

function removeMethodCard(idx) {
  const [removedCard] = properties.value.methods.splice(idx, 1);
  if (!removedCard) return;

  // 清理普通参数的 slots
  if (Array.isArray(removedCard.params)) {
    removedCard.params.forEach((p) => {
      if (p.isSlot) {
        const inputIdx = props.value.inputs.findIndex((i) => i.id === p.id);
        if (inputIdx !== -1) props.value.removeInput(inputIdx);
      }
    });
  }

  // 清理索引访问的 slots
  if (removedCard.methodName === '[index]' && Array.isArray(removedCard.accessChain)) {
    removedCard.accessChain.forEach((item) => {
      if (item.isSlot) {
        const inputIdx = props.value.inputs.findIndex((i) => i.id === item.slotId);
        if (inputIdx !== -1) props.value.removeInput(inputIdx);
      }
    });
  }

  // 删除后更新所有剩余方法的slot标签序号
  updateMethodSlotsLabels();

  triggerUpdate();
}

// === 索引访问相关函数 ===
function addAccessItem(card) {
  if (!card.accessChain) {
    card.accessChain = [];
  }
  card.accessChain.push({
    id: uid(),
    isSlot: false,
    value: '0',
    slotId: uid()
  });
  triggerUpdate();
}

function removeAccessItem(card, index) {
  const removedItem = card.accessChain.splice(index, 1)[0];
  if (removedItem?.isSlot) {
    const slotIndex = props.value.inputs.findIndex(s => s.id === removedItem.slotId);
    if (slotIndex !== -1) {
      props.value.removeInput(slotIndex);
    }
  }
  triggerUpdate();
}

function updateAccessItemSlot(card, item, isSlot) {
  item.isSlot = isSlot;
  const accessIdx = card.accessChain.findIndex(i => i.id === item.id);
  const slot = props.value.inputs.find(s => s.id === item.slotId);

  // slot 名称格式: [index]-{accessIdx}
  const slotName = `[index]-${accessIdx}`;

  if (isSlot && !slot) {
    props.value.addInput(slotName, 'string', { id: item.slotId });
  } else if (!isSlot && slot) {
    const index = props.value.inputs.indexOf(slot);
    props.value.removeInput(index);
  }
  triggerUpdate();
}

function updateParamValue(methodId, paramId, value) {
  const method = properties.value.methods.find(m => m.id === methodId);
  if (method) {
    const param = method.params.find(p => p.id === paramId);
    if (param) {
      param.value = value;
      triggerUpdate();
    }
  }
}

// 判断参数是否可删除（只有可变参数方法的动态添加参数可删除）
function isParamRemovable(methodId, param) {
  const method = properties.value.methods.find(m => m.id === methodId);
  if (!method) return false;

  const methodInfo = getMethodInfo(method.methodName);
  if (!methodInfo?.variadic) return false;

  // 检查参数是否是动态添加的可变参数
  // 动态添加的参数label会以variadicLabel开头（如element0, element1, item0等）
  return param.label.match(new RegExp(`^${methodInfo.variadicLabel}\\d+$`));
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <!-- === 导出控制 === -->
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered class="q-mb-xs ">
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行（VarName slot 开启时禁用） -->
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="export" class="q-mb-xs"
            :disable="properties.enableDeclaration" />

          <!-- VarName Toggle + declareType + Input 一行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="properties.enableDeclaration" label="VarName"
              @update:model-value="updateVarNameSlot" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="properties.declareType"
              @update:model-value="val => updateField('declareType', val)" :options="['const', 'let']"
              :disable="properties.enableDeclaration" style="width: 80px;" />
            <q-input dense dark outlined class="col" :model-value="properties.outputVar"
              @update:model-value="val => updateField('outputVar', val)" placeholder="变量名"
              :disable="properties.enableDeclaration">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    数组操作结果的变量名<br />
                    示例: result, items, filtered
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- === 源数组参数 === -->
      <q-card dark flat bordered class="q-mb-xs">
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="properties.sourceParam?.isSlot || false"
              @update:model-value="updateSourceSlot" label="Value" style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" type="textarea" autogrow
              :model-value="properties.sourceParam?.value"
              @update:model-value="val => updateField('sourceParam.value', val)"
              :disable="properties.sourceParam?.isSlot" placeholder="['a', 1, true]">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    源数组表达式<br />
                    示例: ['a', 1, true]<br />
                    示例: myArray
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 方法/属性/索引链卡片 -->
      <q-card v-for="(card, idx) in (properties.methods || [])" :key="card.id" dark flat bordered class="q-mb-xs"
        @mouseenter="hoverIdx = idx" @mouseleave="hoverIdx = -1" style="position: relative;">
        <q-btn v-if="hoverIdx === idx" icon="close" flat dense color="negative" @click="removeMethodCard(idx)"
          style="position: absolute; right: 8px; top: 8px; z-index: 1;" />
        <q-badge color="primary" class="q-ml-xs q-mt-xs">{{ idx + 1 }}</q-badge>

        <q-card-section class="q-pa-sm" style="padding-right: 48px;">
          <q-select dense dark outlined :options="allOperationOptions" :model-value="card.methodName"
            @update:model-value="val => onMethodChange(card, val)" emit-value map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps" dense>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- === 索引访问 UI === -->
          <template v-if="card.methodName === '[index]'">
            <div v-for="(item, accessIdx) in (card.accessChain || [])" :key="item.id"
              class="row items-center q-gutter-x-sm no-wrap q-mt-xs">

              <q-toggle dense dark :model-value="item.isSlot"
                @update:model-value="val => updateAccessItemSlot(card, item, val)" :label="`[${accessIdx}]`"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :model-value="item.value"
                @update:model-value="val => { item.value = val; triggerUpdate(); }" :disable="item.isSlot"
                placeholder="索引">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      数组索引值<br />
                      示例: 0, 1, 2
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn icon="close" flat dense color="negative" @click="removeAccessItem(card, accessIdx)"
                :disable="card.accessChain.length <= 1" />
            </div>
            <q-btn dense flat no-caps label="Add Index" @click="addAccessItem(card)" class="q-mt-xs full-width"
              color="primary" />
          </template>

          <!-- === 方法/属性参数 UI === -->
          <template v-else>
            <div v-for="p in (card.params || [])" :key="p.id" class="row items-center q-gutter-x-sm no-wrap q-mt-xs">
              <!-- 函数式参数：只显示label -->
              <template v-if="isFunctionParam(p.label)">
                <span class="text-caption text-grey-4" style="min-width: 80px;">{{ p.label }}</span>
              </template>
              <!-- 普通参数：显示参数名、toggle和input -->
              <template v-else>
                <q-toggle dense dark :model-value="p.isSlot"
                  @update:model-value="val => updateSlot(p, val, `${idx + 1}-`)" :label="p.label"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :model-value="p.value"
                  @update:model-value="val => updateParamValue(card.id, p.id, val)" :disable="p.isSlot"
                  placeholder="参数值">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        {{ p.label }} 参数值
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </template>
              <!-- 可变参数删除按钮 -->
              <q-btn v-if="isParamRemovable(card.id, p)" icon="close" flat dense color="negative"
                @click="removeVariadicParam(card.id, p.id)" />
            </div>

            <!-- 可变参数添加按钮 -->
            <q-btn v-if="card.methodName && getMethodInfo(card.methodName)?.variadic" label="Add Parameter" no-caps
              dense flat @click="addVariadicParam(card.id)" color="primary" class="full-width q-mt-sm" />
          </template>
        </q-card-section>
      </q-card>

      <q-btn dense flat no-caps label="Add Operation" @click="addMethodCard" class="q-mt-xs full-width"
        color="primary" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
