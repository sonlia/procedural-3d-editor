<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Store 选择卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-select
            dense
            dark
            outlined
            :model-value="properties.storeId"
            @update:model-value="onStoreChange"
            :options="storeOptions"
            label="选择 Store"
            emit-value
            map-options
          >
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
              <q-icon name="help_outline" class="cursor-pointer">
                <q-tooltip class="bg-dark" max-width="250px">
                  选择要引用的 Pinia Store<br />
                  Store 必须在当前 graph 中定义
                </q-tooltip>
              </q-icon>
            </template>
          </q-select>
        </q-card-section>
      </q-card>

      <!-- 输出成员选择卡片 -->
      <q-card v-if="selectedStore" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">
              输出成员:
            </div>
            <q-btn
              flat
              dense
              icon="add"
              label="添加输出"
              color="primary"
              size="sm"
              @click="addOutput"
            />
          </div>

          <!-- 已选择的输出列表 -->
          <div v-if="selectedOutputs.length > 0" class="q-gutter-y-xs">
            <div
              v-for="(output, index) in selectedOutputs"
              :key="output.id"
              style="position: relative;"
            >
              <div
                class="q-pa-sm rounded-borders"
                style="border: 1px solid #444; padding-right: 48px;"
              >
                <!-- 成员选择下拉框 -->
                <q-select
                  dense
                  dark
                  outlined
                  :model-value="getMemberValue(output)"
                  @update:model-value="val => updateOutputMember(index, val)"
                  :options="getMemberOptionsForOutput(index)"
                  label="选择成员"
                  emit-value
                  map-options
                >
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                  <template v-slot:append>
                    <q-badge
                      v-if="output.type"
                      :color="getMemberColor(output.type)"
                      :label="getMemberTypeLabel(output.type)"
                      class="text-caption q-mr-xs"
                    />
                  </template>
                </q-select>

                <!-- Action 参数配置 -->
                <div v-if="output.type === 'action' && getActionParams(output.name).length > 0" class="q-mt-sm">
                  <div class="text-caption text-grey-5 q-mb-xs">参数:</div>
                  <div v-for="(param, idx) in getActionParams(output.name)" :key="idx" class="q-mt-xs">
                    <div class="row items-center q-gutter-x-sm no-wrap">
                      <q-toggle
                        dense
                        dark
                        :label="param.name"
                        :model-value="getParamConfig(output.name, idx)?.isSlot || false"
                        @update:model-value="val => updateParamSlot(output.name, idx, param.name, val)"
                        style="min-width: 90px; flex-shrink: 0;"
                      />
                      <q-input
                        dense
                        dark
                        outlined
                        :model-value="getParamConfig(output.name, idx)?.value || ''"
                        @update:model-value="val => updateParamValue(output.name, idx, val)"
                        :disable="getParamConfig(output.name, idx)?.isSlot || false"
                        class="col"
                      >
                        <template v-slot:append>
                          <q-icon name="help_outline"  class="cursor-pointer">
                            <q-tooltip class="bg-dark" max-width="250px">
                              参数 {{ param.name }}<br />
                              切换 slot 以从其他节点接入值
                            </q-tooltip>
                          </q-icon>
                        </template>
                      </q-input>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 删除按钮 -->
              <q-btn
                flat
                dense
                icon="close"
                color="negative"
                size="sm"
                @click="removeOutput(index)"
                style="position: absolute; right: 8px; top: 8px;"
              />
            </div>
          </div>

          <div v-else class="text-caption text-grey-6">
            点击"添加输出"按钮选择要输出的成员
          </div>
        </q-card-section>
      </q-card>

      <!-- 提示信息卡片 -->
      <q-card v-if="!selectedStore" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5">
            <q-icon name="info" class="q-mr-xs" />
            请先选择一个 Store
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import { uid } from "quasar";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 获取可用的 store 列表
const storeOptions = computed(() => {
  const pinia = props.value?.graph?.extra?.pinia || {};
  return Object.values(pinia).map((store) => ({
    label: store.storeVar,
    value: store.id,
    description: `Store: ${store.name}`,
  }));
});

// 当前选择的 store
const selectedStore = computed(() => {
  const storeId = properties.value.storeId;
  if (!storeId) return null;
  return props.value?.graph?.extra?.pinia?.[storeId];
});

// 已选择的输出成员
const selectedOutputs = computed(() => properties.value.selectedOutputs || []);

// 获取所有可用的成员列表
const allMembers = computed(() => {
  if (!selectedStore.value) return [];

  const members = [];

  // State
  selectedStore.value.state
    ?.filter((s) => s.expose)
    .forEach((s) => {
      members.push({
        name: s.name,
        type: "state",
        category: "State",
        details: "",
      });
    });

  // Getters
  selectedStore.value.getters
    ?.filter((g) => g.expose)
    .forEach((g) => {
      members.push({
        name: g.name,
        type: "getter",
        category: "Getter",
        details: "",
      });
    });

  // Actions
  selectedStore.value.actions
    ?.filter((a) => a.expose)
    .forEach((a) => {
      const params = a.params || [];
      const paramStr = params.length > 0
        ? `(${params.map(p => p.name).join(", ")})`
        : "()";

      members.push({
        name: a.name,
        type: "action",
        category: "Action",
        details: paramStr,
      });
    });

  return members;
});

// 获取某个输出项的下拉选项（排除已被其他输出项选择的成员）
function getMemberOptionsForOutput(outputIndex) {
  const currentOutput = selectedOutputs.value[outputIndex];
  const otherSelectedMembers = selectedOutputs.value
    .filter((_, idx) => idx !== outputIndex && _.type && _.name)
    .map(o => `${o.type}:${o.name}`);

  return allMembers.value
    .filter(m => {
      const key = `${m.type}:${m.name}`;
      // 当前输出项已选择的成员 或 未被其他输出项选择的成员
      return (currentOutput && currentOutput.type === m.type && currentOutput.name === m.name) ||
             !otherSelectedMembers.includes(key);
    })
    .map(m => ({
      label: m.name + m.details,
      value: `${m.type}:${m.name}`,
      description: m.category,
    }));
}

// 获取成员的 value 字符串
function getMemberValue(output) {
  if (!output.type || !output.name) return null;
  return `${output.type}:${output.name}`;
}

// 获取成员颜色
function getMemberColor(type) {
  if (type === "state") return "blue-5";
  if (type === "getter") return "green-5";
  if (type === "action") return "orange-5";
  return "grey";
}

// 获取成员类型标签
function getMemberTypeLabel(type) {
  if (type === "state") return "State";
  if (type === "getter") return "Getter";
  if (type === "action") return "Action";
  return "";
}

// 获取 action 的参数
function getActionParams(actionName) {
  if (!selectedStore.value) return [];
  const action = selectedStore.value.actions?.find(a => a.name === actionName);
  return action?.params || [];
}

// 获取参数配置
function getParamConfig(actionName, paramIndex) {
  const actionParams = properties.value.actionParams || {};
  const params = actionParams[actionName] || [];
  return params[paramIndex] || { id: uid(), isSlot: false, value: "" };
}

// 更新参数的 isSlot
function updateParamSlot(actionName, paramIndex, paramName, isSlot) {
  // 初始化 actionParams
  if (!properties.value.actionParams) {
    set(properties.value, "actionParams", {});
  }
  if (!properties.value.actionParams[actionName]) {
    set(properties.value.actionParams, actionName, []);
  }

  // 获取或创建参数配置
  const params = properties.value.actionParams[actionName];
  if (!params[paramIndex]) {
    params[paramIndex] = { id: uid(), isSlot: false, value: "" };
  }

  params[paramIndex].isSlot = isSlot;
  params[paramIndex].name = paramName;

  // 更新 slots
  props.value.updateSlots?.();
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新参数值
function updateParamValue(actionName, paramIndex, value) {
  if (!properties.value.actionParams) {
    set(properties.value, "actionParams", {});
  }
  if (!properties.value.actionParams[actionName]) {
    set(properties.value.actionParams, actionName, []);
  }

  const params = properties.value.actionParams[actionName];
  if (!params[paramIndex]) {
    params[paramIndex] = { id: uid(), isSlot: false, value: "" };
  }

  params[paramIndex].value = value;

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新输出成员选择
function updateOutputMember(index, value) {
  if (!value) return;

  const [type, name] = value.split(":");
  const outputs = [...selectedOutputs.value];

  // 如果是新选择的 action，需要清理旧的参数配置
  if (outputs[index].type === "action" && outputs[index].name) {
    const oldActionName = outputs[index].name;
    if (properties.value.actionParams && properties.value.actionParams[oldActionName]) {
      delete properties.value.actionParams[oldActionName];
    }
  }

  outputs[index] = {
    ...outputs[index],
    type,
    name,
  };

  set(properties.value, "selectedOutputs", outputs);

  // 如果是 action，初始化参数配置
  if (type === "action") {
    const action = selectedStore.value.actions?.find(a => a.name === name);
    if (action && action.params && action.params.length > 0) {
      if (!properties.value.actionParams) {
        set(properties.value, "actionParams", {});
      }
      set(
        properties.value.actionParams,
        name,
        action.params.map(param => ({
          id: uid(),
          name: param.name,
          isSlot: false,
          value: "",
        }))
      );
    }
  }

  // 更新 slots
  props.value.updateSlots?.();
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 添加输出（直接添加空项）
function addOutput() {
  const newOutput = {
    id: uid(),
    type: null,
    name: null,
  };

  const outputs = [...selectedOutputs.value, newOutput];
  set(properties.value, "selectedOutputs", outputs);
}

// 移除输出
function removeOutput(index) {
  const output = selectedOutputs.value[index];
  const outputs = selectedOutputs.value.filter((_, i) => i !== index);
  set(properties.value, "selectedOutputs", outputs);

  // 如果是 action，清理参数配置
  if (output.type === "action" && output.name && properties.value.actionParams) {
    delete properties.value.actionParams[output.name];
  }

  // 更新 slots
  props.value.updateSlots?.();
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// Store 选择变化
function onStoreChange(storeId) {
  set(properties.value, "storeId", storeId);

  // 更新 storeName（用于显示）
  const store = props.value?.graph?.extra?.pinia?.[storeId];
  if (store) {
    set(properties.value, "storeName", store.name);
  }

  // 清空输出和参数配置
  set(properties.value, "selectedOutputs", []);
  set(properties.value, "actionParams", {});

  // 更新 slots
  props.value.updateSlots?.();
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>
