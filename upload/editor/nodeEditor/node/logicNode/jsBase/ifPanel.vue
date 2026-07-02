<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import { uid } from "quasar";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

// 数据绑定
const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 响应式更新
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 触发图形重新执行
function triggerGraphRun() {
  props.value.onExecute?.();
  if (props.value?.graph) {
    props.value.graph.runStep();
  }
}

// 比较操作符（带描述）
const comparisonOperators = [
  { label: "<", value: "<", description: "小于" },
  { label: ">", value: ">", description: "大于" },
  { label: "<=", value: "<=", description: "小于等于" },
  { label: ">=", value: ">=", description: "大于等于" },
  { label: "==", value: "==", description: "相等（类型转换）" },
  { label: "!=", value: "!=", description: "不等（类型转换）" },
  { label: "===", value: "===", description: "严格相等" },
  { label: "!==", value: "!==", description: "严格不等" },
];

// 逻辑连接符（带描述）
const logicConnectors = [
  { label: "&&", value: "&&", description: "与：两者都为真" },
  { label: "||", value: "||", description: "或：任一为真" },
];

// --- 条件管理 ---
function createCondition() {
  return {
    id: uid(),
    lhs: "",
    lhsIsSlot: false,
    op: "===",
    rhs: "",
    rhsIsSlot: false,
    connector: "&&",
  };
}

function addCondition() {
  if (!properties.value.conditions) {
    properties.value.conditions = [];
  }
  properties.value.conditions.push(createCondition());
  triggerGraphRun();
}

function removeCondition(index) {
  properties.value.conditions.splice(index, 1);
  triggerGraphRun();
}

function updateCondition(index, key, value) {
  set(properties.value.conditions[index], key, value);

  // 处理 slot 开关
  if (key === "lhsIsSlot" || key === "rhsIsSlot") {
    const side = key === "lhsIsSlot" ? "L" : "R";
    const slotName = `If_${index}_${side}`;
    const cond = properties.value.conditions[index];
    const slotId = side === "L" ? `cond_${cond.id}_L` : `cond_${cond.id}_R`;

    const existingIdx = props.value.inputs.findIndex((s) => s.name === slotName);

    if (value && existingIdx === -1) {
      props.value.addInput(slotName, "string", { id: slotId });
    } else if (!value && existingIdx !== -1) {
      props.value.removeInput(existingIdx);
    }
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- elseif 分支管理 ---
function addElseIfBranch() {
  const branch = {
    id: uid(),
    conditions: [createCondition()],
    branchId: uid(),
  };

  if (!properties.value.elseifBranches) {
    properties.value.elseifBranches = [];
  }
  properties.value.elseifBranches.push(branch);

  // 不添加 function slot，由用户连接时自动处理

  triggerGraphRun();
}

function removeElseIfBranch(branchIndex) {
  const branch = properties.value.elseifBranches[branchIndex];
  if (!branch) return;

  // 移除 function slot
  const slotIndex = props.value.inputs.findIndex((s) => s.id === branch.branchId);
  if (slotIndex !== -1) {
    props.value.removeInput(slotIndex);
  }

  properties.value.elseifBranches.splice(branchIndex, 1);
  triggerGraphRun();
}

// elseif 条件管理
function addElseIfCondition(branchIndex) {
  properties.value.elseifBranches[branchIndex].conditions.push(createCondition());
  triggerGraphRun();
}

function removeElseIfCondition(branchIndex, condIndex) {
  properties.value.elseifBranches[branchIndex].conditions.splice(condIndex, 1);
  triggerGraphRun();
}

function updateElseIfCondition(branchIndex, condIndex, key, value) {
  set(properties.value.elseifBranches[branchIndex].conditions[condIndex], key, value);

  // 处理 slot 开关
  if (key === "lhsIsSlot" || key === "rhsIsSlot") {
    const side = key === "lhsIsSlot" ? "L" : "R";
    const slotName = `eif_${branchIndex + 1}_${condIndex}_${side}`;
    const cond = properties.value.elseifBranches[branchIndex].conditions[condIndex];
    const slotId = `eicond_${cond.id}_${side}`;

    const existingIdx = props.value.inputs.findIndex((s) => s.name === slotName);

    if (value && existingIdx === -1) {
      props.value.addInput(slotName, "string", { id: slotId });
    } else if (!value && existingIdx !== -1) {
      props.value.removeInput(existingIdx);
    }
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- else 分支管理 ---
function toggleElse(hasElse) {
  updateField("hasElse", hasElse);
}

</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- if 条件构建器 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">If Condition</div>

          <div v-for="(cond, index) in (properties.conditions || [])" :key="cond.id" class="q-mt-sm">
            <!-- 逻辑连接符（非第一个条件） -->
            <q-select v-if="index > 0" dense dark outlined :model-value="properties.conditions[index - 1].connector"
              @update:model-value="val => updateCondition(index - 1, 'connector', val)" :options="logicConnectors"
              emit-value map-options class="q-mb-sm">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div style="position: relative;">
              <div class="q-pa-sm rounded-borders" style="border: 1px solid #444; padding-right: 42px;">
                <!-- A [op] B 同一行 -->
                <div class="row items-center q-gutter-x-sm no-wrap">
                  <!-- A (左值) -->
                  <q-toggle dense dark :model-value="cond.lhsIsSlot"
                    @update:model-value="val => updateCondition(index, 'lhsIsSlot', val)" style="flex-shrink: 0;" />
                  <q-input dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.lhs"
                    :disable="cond.lhsIsSlot" @update:model-value="val => updateCondition(index, 'lhs', val)"
                    placeholder="左值" />

                  <!-- Operator -->
                  <q-select dense dark outlined style="width: 70px; flex-shrink: 0;" :model-value="cond.op"
                    @update:model-value="val => updateCondition(index, 'op', val)" :options="comparisonOperators"
                    emit-value map-options>
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>

                  <!-- B (右值) -->
                  <q-toggle dense dark :model-value="cond.rhsIsSlot"
                    @update:model-value="val => updateCondition(index, 'rhsIsSlot', val)" style="flex-shrink: 0;" />
                  <q-input dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.rhs"
                    :disable="cond.rhsIsSlot" @update:model-value="val => updateCondition(index, 'rhs', val)"
                    placeholder="右值" />
                </div>
              </div>
              <q-btn flat dense icon="close" color="negative" @click="removeCondition(index)"
                style="position: absolute; right: 8px; top: 8px;" />
            </div>
          </div>

          <q-btn flat dense no-caps label="Add Condition" color="primary" @click="addCondition"
            class="q-mt-sm full-width" />
        </q-card-section>
      </q-card>

      <!-- elseif 分支配置 -->
      <q-card v-for="(branch, branchIndex) in (properties.elseifBranches || [])" :key="branch.id" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <q-badge color="primary" class="q-ml-xs q-mt-xs">{{ branchIndex + 1 }}</q-badge>

            <q-btn flat dense icon="close" color="negative" @click="removeElseIfBranch(branchIndex)" />
          </div>

          <div v-for="(cond, condIndex) in branch.conditions" :key="cond.id" class="q-mt-sm">
            <!-- 逻辑连接符 -->
            <q-select v-if="condIndex > 0" dense dark outlined :model-value="branch.conditions[condIndex - 1].connector"
              @update:model-value="val => updateElseIfCondition(branchIndex, condIndex - 1, 'connector', val)"
              :options="logicConnectors" emit-value map-options class="q-mb-sm">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div style="position: relative;">
              <div class="q-pa-sm rounded-borders" style="border: 1px solid #444; padding-right: 42px;">
                <div class="row items-center q-gutter-x-sm no-wrap">
                  <!-- A -->
                  <q-toggle dense dark :model-value="cond.lhsIsSlot"
                    @update:model-value="val => updateElseIfCondition(branchIndex, condIndex, 'lhsIsSlot', val)"
                    style="flex-shrink: 0;" />
                  <q-input dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.lhs"
                    :disable="cond.lhsIsSlot"
                    @update:model-value="val => updateElseIfCondition(branchIndex, condIndex, 'lhs', val)"
                    placeholder="左值" />

                  <!-- Operator -->
                  <q-select dense dark outlined style="width: 70px; flex-shrink: 0;" :model-value="cond.op"
                    @update:model-value="val => updateElseIfCondition(branchIndex, condIndex, 'op', val)"
                    :options="comparisonOperators" emit-value map-options>
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>

                  <!-- B -->
                  <q-toggle dense dark :model-value="cond.rhsIsSlot"
                    @update:model-value="val => updateElseIfCondition(branchIndex, condIndex, 'rhsIsSlot', val)"
                    style="flex-shrink: 0;" />
                  <q-input dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.rhs"
                    :disable="cond.rhsIsSlot"
                    @update:model-value="val => updateElseIfCondition(branchIndex, condIndex, 'rhs', val)"
                    placeholder="右值" />
                </div>
              </div>
              <q-btn v-if="branch.conditions.length > 1" flat dense icon="close" color="negative"
                @click="removeElseIfCondition(branchIndex, condIndex)"
                style="position: absolute; right: 8px; top: 8px;" />
            </div>
          </div>

          <q-btn flat dense no-caps label="Add Condition" color="primary" @click="addElseIfCondition(branchIndex)"
            class="q-mt-sm full-width" />
        </q-card-section>
      </q-card>

      <!-- else 分支配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-4 q-mb-xs">else 分支</div>

          <q-checkbox dense dark :model-value="properties.hasElse" @update:model-value="toggleElse" label="启用 else 分支"
            class="q-mb-xs" />
        </q-card-section>
      </q-card>

      <!-- 操作按钮 -->

      <q-btn flat dense no-caps label="Add else if" color="primary" class="q-mt-sm full-width"
        @click="addElseIfBranch" />


    </div>
  </BasePropertyPanel>
</template>
