<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { uid } from "quasar";
import { cloneDeep, isEqual } from "lodash-es";
import { routerPropertyMap, routerMethodParamMap } from "./base.js";
import BasePropertyPanel from "../../propertyPanel/BasePropertyPanel.vue";
import routes from "src/router/routes.js";

const props = defineModel(); // node instance

// 解析路由配置，提取所有 path 和 name
function extractRoutes(routeList, parentPath = "") {
  const result = [];

  for (const route of routeList) {
    const fullPath = parentPath + (route.path || "");

    if (route.path) {
      result.push({
        path: fullPath,
        name: route.name || "",
        meta: route.meta || {},
      });
    }

    if (route.children && route.children.length > 0) {
      result.push(...extractRoutes(route.children, fullPath));
    }
  }

  return result;
}

const availableRoutes = extractRoutes(routes);
const pathOptions = availableRoutes
  .filter((r) => r.path && !r.path.includes(":catchAll"))
  .map((r) => ({
    label: r.path,
    value: `"${r.path}"`,
    description: r.name ? `Route: ${r.name}` : "匿名路由",
  }));

// Delta 预设选项
const deltaOptions = [
  { label: "后退 3 步", value: "-3", description: "go(-3)" },
  { label: "后退 2 步", value: "-2", description: "go(-2)" },
  { label: "后退 1 步", value: "-1", description: "go(-1) - 等同 back()" },
  { label: "前进 1 步", value: "1", description: "go(1) - 等同 forward()" },
  { label: "前进 2 步", value: "2", description: "go(2)" },
  { label: "前进 3 步", value: "3", description: "go(3)" },
];

const propertyOptions = Object.keys(routerPropertyMap).map((p) => ({
  label: p,
  value: p,
  description: routerPropertyMap[p].desc,
}));

const methodOptions = Object.keys(routerMethodParamMap).map((m) => ({
  label: m,
  value: m,
  description: routerMethodParamMap[m].desc,
}));

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];

// 常用路由参数名选项
const paramKeyOptions = [
  { label: "id", value: "id", description: "资源唯一标识" },
  { label: "name", value: "name", description: "命名路由参数" },
  { label: "slug", value: "slug", description: "URL 友好标识" },
  { label: "type", value: "type", description: "类型标识" },
  { label: "category", value: "category", description: "分类标识" },
  { label: "page", value: "page", description: "页码" },
  { label: "userId", value: "userId", description: "用户 ID" },
  { label: "postId", value: "postId", description: "文章 ID" },
];

// 常用 query 参数名选项
const queryKeyOptions = [
  { label: "page", value: "page", description: "当前页码" },
  { label: "limit", value: "limit", description: "每页数量" },
  { label: "offset", value: "offset", description: "偏移量" },
  { label: "sort", value: "sort", description: "排序字段" },
  { label: "order", value: "order", description: "排序方向 asc/desc" },
  { label: "search", value: "search", description: "搜索关键词" },
  { label: "filter", value: "filter", description: "筛选条件" },
  { label: "tab", value: "tab", description: "标签页标识" },
  { label: "id", value: "id", description: "资源 ID" },
  { label: "type", value: "type", description: "类型筛选" },
];

// --- Data Model & Sync ---
const defaultProperties = () => ({
  exported: false,
  outputVar: { id: uid(), isSlot: false, value: `routeResult_${uid().slice(0, 8)}` },
  declareType: "const",
  useAwait: false,
  operation: {
    id: uid(),
    type: "method",
    name: "push",
    location: {
      path: { id: uid(), isSlot: false, value: "" },
      params: [],
      queryItems: [],
    },
    deltaParam: { id: uid(), isSlot: false, value: "-1" },
  },
});

const localProperties = ref(defaultProperties());

// --- Computed Property for Disabling Output ---
const disableOutput = computed(() => {
  const op = localProperties.value.operation;
  if (!op) return true;

  let hasReturnValue = false;
  if (op.type === "method") {
    hasReturnValue = routerMethodParamMap[op.name]?.hasReturnValue;
  } else if (op.type === "property") {
    hasReturnValue = routerPropertyMap[op.name]?.hasReturnValue;
  }

  return !hasReturnValue;
});

// --- Show await checkbox for push/replace ---
const showAwaitCheckbox = computed(() => {
  const op = localProperties.value.operation;
  return (
    op &&
    op.type === "method" &&
    (op.name === "push" || op.name === "replace")
  );
});

// --- Show location config for push/replace ---
const showLocationConfig = computed(() => {
  const op = localProperties.value.operation;
  return (
    op &&
    op.type === "method" &&
    (op.name === "push" || op.name === "replace")
  );
});

// --- Show delta param for go ---
const showDeltaParam = computed(() => {
  const op = localProperties.value.operation;
  return op && op.type === "method" && op.name === "go";
});

// --- outValue Slot Management ---
watch(
  () => {
    const op = localProperties.value.operation;
    if (!op) return { hasReturnValue: false, opName: null };

    let hasReturnValue = false;
    if (op.type === "method") {
      hasReturnValue = routerMethodParamMap[op.name]?.hasReturnValue ?? false;
    } else if (op.type === "property") {
      hasReturnValue = routerPropertyMap[op.name]?.hasReturnValue ?? false;
    }
    return { hasReturnValue, opName: op.name };
  },
  ({ hasReturnValue }) => {
    if (!props.value) return;

    const outSlotIndex =
      props.value.outputs?.findIndex((o) => o.name === "outValue") ?? -1;

    if (hasReturnValue && outSlotIndex === -1) {
      props.value.addOutput("outValue", "string", { id: "default_out" });
    } else if (!hasReturnValue && outSlotIndex !== -1) {
      props.value.removeOutput(outSlotIndex);
    }
  },
  { immediate: true }
);

onMounted(() => {
  const initialProps = {
    ...defaultProperties(),
    ...cloneDeep(props.value?.properties ?? {}),
  };
  if (!initialProps.operation) {
    initialProps.operation = defaultProperties().operation;
  }

  // 确保 params 和 queryItems 存在
  if (!initialProps.operation.location) {
    initialProps.operation.location = defaultProperties().operation.location;
  }
  if (!Array.isArray(initialProps.operation.location.params)) {
    initialProps.operation.location.params = [];
  }
  if (!Array.isArray(initialProps.operation.location.queryItems)) {
    initialProps.operation.location.queryItems = [];
  }

  localProperties.value = initialProps;
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

watch(
  localProperties,
  (newVal) => {
    if (!isEqual(props.value.properties, newVal)) {
      props.value.properties = cloneDeep(newVal);
      props.value.onExecute?.();
      props.value.graph?.setDirtyCanvas?.(true, true);
    }
  },
  { deep: true }
);

watch(
  () => props.value?.properties,
  (newVal) => {
    const newProps = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
    if (!isEqual(newProps, localProperties.value)) {
      localProperties.value = newProps;
    }
  },
  { deep: true }
);

// --- OutputVar Slot Management ---
watch(
  () => localProperties.value.outputVar?.isSlot,
  (isSlot) => {
    const slotId = localProperties.value.outputVar?.id;
    if (!slotId) return;
    const exists = props.value.inputs?.find((s) => s.id === slotId);

    if (isSlot && !exists) {
      props.value.addInput("VarName", "string", { id: slotId });
    } else if (!isSlot && exists) {
      props.value.removeInput(props.value.inputs.indexOf(exists));
    }
  },
  { immediate: true }
);

// --- UI Event Handlers ---
function onTypeChange(type) {
  const op = localProperties.value.operation;

  // 清理 slot
  clearAllLocationSlots();

  op.type = type;
  if (type === "method") {
    op.name = "push";
  } else {
    op.name = "currentRoute";
  }
}

function onNameChange(name) {
  const op = localProperties.value.operation;

  // 清理 slot
  clearAllLocationSlots();

  op.name = name;
}

function clearAllLocationSlots() {
  const op = localProperties.value.operation;

  // 清理 location slots
  if (op.location) {
    // path
    if (op.location.path?.isSlot) {
      updateLocationSlot(op.location.path, false);
    }

    // params
    if (Array.isArray(op.location.params)) {
      op.location.params.forEach(param => {
        if (param.isSlot) {
          updateLocationSlot(param, false);
        }
      });
    }

    // query items
    if (Array.isArray(op.location.queryItems)) {
      op.location.queryItems.forEach(item => {
        if (item.isSlot) {
          updateLocationSlot(item, false);
        }
      });
    }
  }

  // 清理 delta param slot
  if (op.deltaParam?.isSlot) {
    updateLocationSlot(op.deltaParam, false);
  }
}

function updateLocationSlot(param, isSlot) {
  if (!param || !param.id) return;

  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);

  if (isSlot && existingIdx === -1) {
    const slotName = getSlotName(param);
    props.value.addInput(slotName, "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function getSlotName(param) {
  const op = localProperties.value.operation;

  if (param === op.deltaParam) return "delta";

  // location fields
  if (op.location) {
    if (param === op.location.path) return "path";

    // params
    if (Array.isArray(op.location.params)) {
      const paramIndex = op.location.params.indexOf(param);
      if (paramIndex !== -1) {
        return `param_${param.key || paramIndex}`;
      }
    }

    // query items
    if (Array.isArray(op.location.queryItems)) {
      const queryIndex = op.location.queryItems.indexOf(param);
      if (queryIndex !== -1) {
        return `query_${param.key || queryIndex}`;
      }
    }
  }

  return "param";
}

// --- Params Management ---
function addParamItem() {
  if (!localProperties.value.operation.location.params) {
    localProperties.value.operation.location.params = [];
  }

  localProperties.value.operation.location.params.push({
    id: uid(),
    key: "",
    isSlot: false,
    value: "",
  });
}

function removeParamItem(index) {
  const param = localProperties.value.operation.location.params[index];

  // 清理 slot
  if (param.isSlot) {
    updateLocationSlot(param, false);
  }

  localProperties.value.operation.location.params.splice(index, 1);
}

// --- Query Items Management ---
function addQueryItem() {
  if (!localProperties.value.operation.location.queryItems) {
    localProperties.value.operation.location.queryItems = [];
  }

  localProperties.value.operation.location.queryItems.push({
    id: uid(),
    key: "",
    isSlot: false,
    value: "",
  });
}

function removeQueryItem(index) {
  const item = localProperties.value.operation.location.queryItems[index];

  // 清理 slot
  if (item.isSlot) {
    updateLocationSlot(item, false);
  }

  localProperties.value.operation.location.queryItems.splice(index, 1);
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 输出变量卡片 (仅有返回值时显示) -->
      <q-card v-if="!disableOutput" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="localProperties.exported"
            @update:model-value="(val) => (localProperties.exported = val)" label="Export" class="q-mb-xs"
            :disable="localProperties.outputVar?.isSlot" />

          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="localProperties.outputVar?.isSlot" @update:model-value="
              (val) => (localProperties.outputVar.isSlot = val)
            " style="min-width: 90px; flex-shrink: 0" />
            <q-select dense dark outlined :model-value="localProperties.declareType"
              :disable="localProperties.outputVar?.isSlot"
              @update:model-value="(val) => (localProperties.declareType = val)" :options="declareTypeOptions"
              emit-value map-options class="col-auto" style="width: 80px">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{
                      scope.opt.description
                      }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :model-value="localProperties.outputVar?.value"
              :disable="localProperties.outputVar?.isSlot" @update:model-value="
                (val) => (localProperties.outputVar.value = val)
              " />
          </div>
        </q-card-section>
      </q-card>

      <!-- 操作类型卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-btn-toggle dense dark :model-value="localProperties.operation.type" @update:model-value="onTypeChange"
            :options="[
              { label: 'Method', value: 'method' },
              { label: 'Property', value: 'property' },
            ]" toggle-color="primary" class="q-mb-sm" style="width: 100%" />

          <!-- 方法选择 -->
          <q-select v-if="localProperties.operation.type === 'method'" dense dark outlined
            :model-value="localProperties.operation.name" @update:model-value="onNameChange" :options="methodOptions"
            emit-value map-options label="方法">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{
                    scope.opt.description
                    }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- 属性选择 -->
          <q-select v-if="localProperties.operation.type === 'property'" dense dark outlined
            :model-value="localProperties.operation.name" @update:model-value="onNameChange" :options="propertyOptions"
            emit-value map-options label="属性">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{
                    scope.opt.description
                    }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Await 选项 (仅 push/replace 显示) -->
          <q-checkbox v-if="showAwaitCheckbox" dense dark :model-value="localProperties.useAwait"
            @update:model-value="(val) => (localProperties.useAwait = val)" label="Use await" class="q-mt-sm">
            <template v-slot:default>
              <span>Use await</span>
              <q-icon name="help_outline"  class="q-ml-xs cursor-pointer">
                <q-tooltip class="bg-dark" max-width="250px">
                  push/replace 返回 Promise，可使用 await 等待导航完成
                </q-tooltip>
              </q-icon>
            </template>
          </q-checkbox>
        </q-card-section>
      </q-card>

      <!-- Location 配置卡片 (push/replace) -->
      <q-card v-if="showLocationConfig" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-4 q-mb-sm">Location 配置</div>

          <!-- path -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mt-xs">
            <q-toggle dense dark label="path" :model-value="localProperties.operation.location?.path?.isSlot"
              @update:model-value="
                (val) =>
                  updateLocationSlot(
                    localProperties.operation.location.path,
                    val
                  )
              " style="min-width: 90px; flex-shrink: 0" />
            <q-select dense dark outlined class="col" :model-value="localProperties.operation.location?.path?.value"
              :disable="localProperties.operation.location?.path?.isSlot" @update:model-value="
                (val) =>
                  (localProperties.operation.location.path.value = val)
              " :options="pathOptions" emit-value map-options use-input input-debounce="0" placeholder='选择或输入路径'
              @filter="(val, update) => update()">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{
                      scope.opt.description
                      }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    路径字符串，从列表选择或手动输入<br />
                    支持动态参数 (如 /user/:id)<br />
                    示例: "/home", "/user/:id"
                  </q-tooltip>
                </q-icon>
              </template>
            </q-select>
          </div>

          <!-- Params 列表 -->
          <div class="q-mt-sm">
            <q-separator dark class="q-my-sm" />
            <div class="row items-center justify-between q-mb-xs">
              <div class="text-caption text-grey-4">路由参数</div>
              <q-btn flat dense icon="add" color="primary" @click="addParamItem" />
            </div>

            <div v-for="(param, index) in localProperties.operation.location.params" :key="param.id" class="q-mt-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-badge color="grey-8" :label="index" class="q-mr-xs" />
                <q-select dense dark outlined :model-value="param.key" @update:model-value="(val) => (param.key = val)"
                  :options="paramKeyOptions" emit-value map-options use-input input-debounce="0" placeholder="key"
                  fill-input hide-selected style="width: 100px;" @filter="(val, update) => update()">
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <q-toggle dense dark :model-value="param.isSlot"
                  @update:model-value="(val) => updateLocationSlot(param, val)" style="flex-shrink: 0" />
                <q-input dense dark outlined class="col" :model-value="param.value" :disable="param.isSlot"
                  @update:model-value="(val) => (param.value = val)" placeholder="value" />
                <q-btn flat dense icon="close" color="negative" @click="removeParamItem(index)" />
              </div>
            </div>
          </div>

          <!-- Query 键值对列表 -->
          <div class="q-mt-sm">
            <q-separator dark class="q-my-sm" />
            <div class="row items-center justify-between q-mb-xs">
              <div class="text-caption text-grey-4">Query 参数</div>
              <q-btn flat dense icon="add" color="primary" @click="addQueryItem" />
            </div>

            <div v-for="(item, index) in localProperties.operation.location.queryItems" :key="item.id" class="q-mt-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-badge color="grey-8" :label="index" class="q-mr-xs" />
                <q-select dense dark outlined :model-value="item.key" @update:model-value="(val) => (item.key = val)"
                  :options="queryKeyOptions" emit-value map-options use-input input-debounce="0" placeholder="key"
                  fill-input hide-selected style="width: 100px; flex-shrink: 0" @filter="(val, update) => update()">
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <q-toggle dense dark :model-value="item.isSlot"
                  @update:model-value="(val) => updateLocationSlot(item, val)" style="flex-shrink: 0" />
                <q-input dense dark outlined class="col" :model-value="item.value" :disable="item.isSlot"
                  @update:model-value="(val) => (item.value = val)" placeholder="value" />
                <q-btn flat dense icon="close" color="negative" @click="removeQueryItem(index)" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Delta 参数卡片 (go 方法) -->
      <q-card v-if="showDeltaParam" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-4 q-mb-sm">Delta 参数</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="delta" :model-value="localProperties.operation.deltaParam?.isSlot"
              @update:model-value="
                (val) =>
                  updateLocationSlot(localProperties.operation.deltaParam, val)
              " style="min-width: 90px; flex-shrink: 0" />
            <q-select dense dark outlined class="col" :model-value="localProperties.operation.deltaParam?.value"
              :disable="localProperties.operation.deltaParam?.isSlot" @update:model-value="
                (val) => (localProperties.operation.deltaParam.value = val)
              " :options="deltaOptions" emit-value map-options use-input input-debounce="0" placeholder='选择或输入步数'
              @filter="(val, update) => update()">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{
                      scope.opt.description
                      }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    前进/后退的步数，从列表选择或手动输入<br />
                    正数前进，负数后退<br />
                    示例: -1 (后退), 1 (前进), -2 (后退2步)
                  </q-tooltip>
                </q-icon>
              </template>
            </q-select>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
