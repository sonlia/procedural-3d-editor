<script setup>
import { ref, computed, watch } from "vue";
import { uid } from "quasar";
import { get, set, cloneDeep, isEqual } from "lodash-es";
import BasePropertyPanel from "../../../propertyPanel/BasePropertyPanel.vue";

const props = defineModel();

// 维护本地 properties 副本，避免对整个 node 实例做深度响应式代理造成卡顿
const localProperties = ref({});

// 当外部 properties 变化时，同步到本地副本（immediate 确保首次加载时同步）
watch(
  () => props.value?.properties,
  (newVal) => {
    if (newVal) {
      localProperties.value = cloneDeep(newVal);
    }
  },
  { deep: true, immediate: true }
);

// 监听本地副本，回写到 node 实例的 properties
watch(
  localProperties,
  (val) => {
    if (!isEqual(props.value?.properties, val)) {
      props.value.properties = cloneDeep(val);
      // 触发代码重新生成
      props.value.onExecute?.();
      // 标记画布为脏，确保 UI 更新
      props.value.graph?.setDirtyCanvas?.(true, true);
    }
  },
  { deep: true }
);


// 运算符选项（带描述）
const operatorDescriptions = {
  // 单目
  "++": "自增（变量值+1）",
  "--": "自减（变量值-1）",
  // 算术
  "+": "加法",
  "-": "减法",
  "*": "乘法",
  "/": "除法",
  "%": "取余（模运算）",
  "**": "幂运算",
  // 赋值
  "+=": "加法赋值",
  "-=": "减法赋值",
  "*=": "乘法赋值",
  "/=": "除法赋值",
  "%=": "取余赋值",
  "<<=": "左移赋值",
  ">>=": "右移赋值",
  ">>>=": "无符号右移赋值",
  "&=": "按位与赋值",
  "^=": "按位异或赋值",
  "|=": "按位或赋值",
  // 比较
  "==": "相等（宽松）",
  "===": "全等（严格）",
  "!=": "不相等（宽松）",
  "!==": "不全等（严格）",
  ">": "大于",
  "<": "小于",
  ">=": "大于等于",
  "<=": "小于等于",
  // 逻辑 & 位运算
  "&&": "逻辑与",
  "||": "逻辑或",
  "&": "按位与",
  "|": "按位或",
  "^": "按位异或",
  "<<": "左移",
  ">>": "右移",
  ">>>": "无符号右移"
};

const mainOperatorOptionsRaw = [
  // 单目
  "++", "--",
  // 算术
  "+", "-", "*", "/", "%", "**",
  // 赋值
  "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=", "&=", "^=", "|=",
  // 比较
  "==", "===", "!=", "!==", ">", "<", ">=", "<=",
  // 逻辑 & 位运算
  "&&", "||", "&", "|", "^", "<<", ">>", ">>>"
];
const prefixOperatorOptions = ["!", "~", "!!", " "].map(op => ({
  label: op || "(无)",
  value: op,
  description: op === "!" ? "逻辑非" : op === "~" ? "按位取反" : op === "!!" ? "转布尔值" : "无前缀"
}));

// 运算符分类
const unaryPostfix = ["++", "--"]; // 后缀单目运算符
const unaryPrefix = ["!", "~", "!!"]; // 前缀单目运算符

// 运算符选项（用于后续操作项，排除单目运算符）
const operatorOptions = mainOperatorOptionsRaw
  .filter(op => !unaryPostfix.includes(op) && !unaryPrefix.includes(op))
  .map(op => ({ label: op, value: op, description: operatorDescriptions[op] || "" }));

// 初始值配置
const defaultInitial = () => {
  return {
    id: uid(),
    isSlot: false,
    value: "a",
    prefixOperator: " ",
  };
};

// 操作项配置（运算符 + 操作数）
const defaultOperation = (index = 1) => {
  return {
    id: uid(),
    index,
    operator: "+",
    isSlot: false,
    value: 1,
    prefixOperator: " ",
  };
};

// 声明类型（默认 const）
const declareType = computed({
  get: () => get(localProperties.value, "declareType", "const"),
  set: (val) => set(localProperties.value, "declareType", val),
});
const declareTypeOptions = [
  { label: "(无)", value: "", description: "不生成变量声明" },
  { label: "const", value: "const", description: "常量声明" },
  { label: "let", value: "let", description: "可变变量声明" },
];

// 输出变量名三元组（只读取，不在 computed 中初始化）
const outputVar = computed(() => {
  return localProperties.value.outputVar || { id: "", isSlot: false, value: `result_${uid().slice(0, 8)}` };
});

// 确保 outputVar 三元组存在（在需要时初始化）
function ensureOutputVar() {
  if (!localProperties.value.outputVar) {
    // 变量名默认值遵循规则：`${prefix}_${uid().slice(0, 8)}`
    localProperties.value.outputVar = { id: uid(), isSlot: false, value: `result_${uid().slice(0, 8)}` };
  }
  return localProperties.value.outputVar;
}

// 更新 outputVar 字段
function updateOutputVar(key, value) {
  // 确保 outputVar 已初始化
  ensureOutputVar();
  set(localProperties.value, ["outputVar", key], value);

  // 处理 isSlot 切换
  if (key === "isSlot") {
    const slotId = localProperties.value.outputVar.id;
    const exists = props.value.inputs?.some((i) => i.id === slotId);
    if (value && !exists) {
      props.value.addInput("VarName", "string", { id: slotId });
    } else if (!value && exists) {
      const idx = props.value.inputs.findIndex((i) => i.id === slotId);
      if (idx !== -1) props.value.removeInput(idx);
    }
  }
}

// 通用字段更新函数
function updateField(key, value) {
  set(localProperties.value, key, value);
}

// 初始值 computed
const initial = computed(() => {
  return localProperties.value.initial || null;
});

// 操作项列表 computed
const operations = computed(() => {
  return localProperties.value.operations || [];
});

// 确保初始值存在
function ensureInitial() {
  if (!localProperties.value.initial) {
    localProperties.value.initial = defaultInitial();
  }
  return localProperties.value.initial;
}

// 更新初始值字段
function updateInitial(key, value) {
  ensureInitial();
  set(localProperties.value, ["initial", key], value);

  // 处理 isSlot 切换
  if (key === "isSlot") {
    const slotId = localProperties.value.initial.id;
    const exists = props.value.inputs?.some((i) => i.id === slotId);
    if (value && !exists) {
      props.value.addInput("Initial", "string", { id: slotId });
    } else if (!value && exists) {
      const idx = props.value.inputs.findIndex((i) => i.id === slotId);
      if (idx !== -1) props.value.removeInput(idx);
    }
  }
}

// 添加操作项（运算符 + 操作数）
function addOperation() {
  // 确保初始值存在
  ensureInitial();

  const idx = (localProperties.value.operations?.length || 0) + 1;
  const op = defaultOperation(idx);

  if (!localProperties.value.operations) {
    localProperties.value.operations = [op];
  } else {
    localProperties.value.operations.push(op);
  }

  // output outValue（只需一次）
  if (!props.value.outputs.find((o) => o.name === "outValue")) {
    props.value.addOutput("outValue", "string", { id: uid() });
  }
}

// 删除操作项
function removeOperation(idx) {
  const removeOp = localProperties.value.operations.splice(idx, 1).pop();

  // 移除对应的输入插槽
  if (removeOp) {
    const inIdx = props.value.inputs.findIndex((i) => i.id === removeOp.id);
    if (inIdx !== -1) {
      props.value.removeInput(inIdx);
    }
  }

  // 重新编号
  localProperties.value.operations.forEach((op, i) => {
    op.index = i + 1;
  });

  // 如果没有任何 operation 且没有初始值，移除输出 outValue
  if (operations.value.length === 0 && !initial.value) {
    const outIdx = props.value.outputs.findIndex((o) => o.name === "outValue");
    if (outIdx !== -1) {
      props.value.removeOutput(outIdx);
    }
  }
}

// 更新操作项
function updateOperation(idx, key, value) {
  set(localProperties.value, ["operations", idx, key], value);

  const operation = localProperties.value.operations[idx];

  // 处理 isSlot 切换
  if (key === "isSlot") {
    const exists = props.value.inputs.some((i) => i.id === operation.id);
    if (value && !exists) {
      props.value.addInput(`操作${operation.index}`, "string", { id: operation.id });
    } else if (!value && exists) {
      const inIdx = props.value.inputs.findIndex((i) => i.id === operation.id);
      if (inIdx !== -1) props.value.removeInput(inIdx);
    }
  }

  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <!-- ⚠️ 必须用 div 包裹，提供呼吸空间和统一间距 -->
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 分区 1：输出变量配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox dense dark :model-value="localProperties.exported"
            @update:model-value="val => updateField('exported', val)" :disable="outputVar.isSlot" label="Export"
            class="q-mb-xs" />
          <!-- 变量声明行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="outputVar.isSlot" @update:model-value="val => updateOutputVar('isSlot', val)" dense
              dark label="VarName" style="min-width: 90px; flex-shrink: 0;" />
            <q-select v-model="declareType" :options="declareTypeOptions" :disable="outputVar.isSlot" dense dark
              outlined emit-value map-options style="width: 90px;" dropdown-icon="arrow_drop_down">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input :model-value="outputVar.value" @update:model-value="val => updateOutputVar('value', val)"
              :disable="outputVar.isSlot" dense dark outlined placeholder="输出变量名" class="col">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    运算结果存储的变量名<br />
                    示例: result, sum, total
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 2：初始值配置（当有初始值时显示） -->
      <q-card v-if="initial" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-6 q-mb-xs">Initial Value</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="initial.isSlot" @update:model-value="val => updateInitial('isSlot', val)" dense dark
              label="Slot" style="min-width: 75px; flex-shrink: 0;" />
            <q-select style="width: 90px;" dense dark outlined emit-value map-options :options="prefixOperatorOptions"
              :model-value="initial.prefixOperator" @update:model-value="val => updateInitial('prefixOperator', val)"
              :disable="initial.isSlot" dropdown-icon="arrow_drop_down">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input :model-value="initial.value" @update:model-value="val => updateInitial('value', val)"
              :disable="initial.isSlot" dense dark outlined placeholder="initial value" class="col">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    表达式的起始值<br />
                    示例: a, num1, 0
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 3：操作项列表（运算符 + 操作数） -->
      <q-card v-for="(op, idx) in operations" :key="op.id" dark flat bordered style="position: relative;">
        <!-- 内容容器：通过 padding-right 为删除按钮预留空间 -->
        <q-card-section class="q-pa-sm" style="padding-right: 48px;">
          <!-- 运算符选择 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-badge :label="idx + 1" color="primary" class="q-mr-xs" />
            <q-select :model-value="op.operator" @update:model-value="val => updateOperation(idx, 'operator', val)"
              :options="operatorOptions" dense dark outlined emit-value map-options style="width: 80px; flex-shrink: 0;"
              dropdown-icon="arrow_drop_down">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- 操作数配置 -->
            <q-toggle :model-value="op.isSlot" @update:model-value="val => updateOperation(idx, 'isSlot', val)" dense
              dark   style="  flex-shrink: 0;" />
            <q-select style="width: 70px;" dense dark outlined emit-value map-options :options="prefixOperatorOptions"
              :model-value="op.prefixOperator" @update:model-value="val => updateOperation(idx, 'prefixOperator', val)"
              :disable="op.isSlot" dropdown-icon="arrow_drop_down">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input :model-value="op.value" @update:model-value="val => updateOperation(idx, 'value', val)"
              :disable="op.isSlot" dense dark outlined placeholder="operand" class="col">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    参与运算的操作数<br />
                    示例: b, num2, 1
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>

        <!-- 删除按钮：绝对定位在右上角 -->
        <q-btn flat dense icon="close" color="negative" @click="removeOperation(idx)"
          style="position: absolute; right: 8px; top: 8px;" />
      </q-card>

      <!-- add 按钮 -->
      <q-btn flat color="primary" label="Add Operation" no-caps dense @click="addOperation" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
