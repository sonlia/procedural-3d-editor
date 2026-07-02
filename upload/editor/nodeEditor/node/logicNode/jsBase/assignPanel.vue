<script setup>
import { watch, computed } from 'vue';
import { set } from "lodash-es";
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});
const assignments = computed(() => properties.value.assignments || []);

const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
];

// 添加新的赋值项
function addAssignment() {
  if (!props.value) return;

  const newAssignment = props.value.createAssignmentItem();
  assignments.value.push(newAssignment);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 删除赋值项
function removeAssignment(index, assignment) {
  if (!props.value || assignments.value.length <= 1) return;

  const node = props.value;

  // 移除相关的输入插槽
  const nameSlot = node.inputs.find(s => s.id === assignment.nameSlotId);
  if (nameSlot) {
    const slotIndex = node.inputs.indexOf(nameSlot);
    node.removeInput(slotIndex);
  }

  const valueSlot = node.inputs.find(s => s.id === assignment.valueSlotId);
  if (valueSlot) {
    const slotIndex = node.inputs.indexOf(valueSlot);
    node.removeInput(slotIndex);
  }

  assignments.value.splice(index, 1);

  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 统一更新函数
function updateField(assignment, key, value) {
  set(assignment, key, value);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 监听每个赋值项的 isNameSlot 变化
watch(() => assignments.value.map(a => ({ id: a.id, isNameSlot: a.isNameSlot, nameSlotId: a.nameSlotId })),
  (newVals, oldVals) => {
    if (!props.value) return;
    const node = props.value;

    newVals.forEach((val, idx) => {
      const assignment = assignments.value[idx];
      if (!assignment) return;

      const slotId = assignment.nameSlotId;
      const existingSlot = node.inputs.find(s => s.id === slotId);

      if (assignment.isNameSlot && !existingSlot) {
        node.addInput(`name${idx > 0 ? idx : ''}`, 'string', { id: slotId });
      } else if (!assignment.isNameSlot && existingSlot) {
        const slotIndex = node.inputs.indexOf(existingSlot);
        node.removeInput(slotIndex);
      }
    });

    node.onExecute?.();
    node.graph?.setDirtyCanvas?.(true, true);
  },
  { deep: true, immediate: true }
);

// 监听每个赋值项的 isValueSlot 变化
watch(() => assignments.value.map(a => ({ id: a.id, isValueSlot: a.isValueSlot, valueSlotId: a.valueSlotId })),
  (newVals) => {
    if (!props.value) return;
    const node = props.value;

    newVals.forEach((val, idx) => {
      const assignment = assignments.value[idx];
      if (!assignment) return;

      const slotId = assignment.valueSlotId;
      const existingSlot = node.inputs.find(s => s.id === slotId);

      if (assignment.isValueSlot && !existingSlot) {
        node.addInput(`value${idx > 0 ? idx : ''}`, 'string', { id: slotId });
      } else if (!assignment.isValueSlot && existingSlot) {
        const slotIndex = node.inputs.indexOf(existingSlot);
        node.removeInput(slotIndex);
      }
    });

    node.onExecute?.();
    node.graph?.setDirtyCanvas?.(true, true);
  },
  { deep: true, immediate: true }
);
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 循环渲染每个赋值项 -->
      <q-card v-for="(assignment, index) in assignments" :key="assignment.id" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- 标题栏 -->
          <div class="row items-center justify-between q-mb-sm">
            <q-badge color="primary" class="q-ml-xs q-mt-xs">{{ index + 1 }}</q-badge>
            <q-btn v-if="assignments.length > 1" icon="close" flat dense color="negative"
              @click="removeAssignment(index, assignment)">
              <q-tooltip>删除此项</q-tooltip>
            </q-btn>
          </div>

          <!-- Export 单独一行（仅非 slot 模式显示） -->
          <q-checkbox :disable="assignment.isNameSlot" dense dark :model-value="assignment.exported"
            @update:model-value="val => updateField(assignment, 'exported', val)" label="Export" class="q-mb-xs" />

          <!-- 变量名行: toggle → 声明下拉框 → 输入框 -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
            <q-toggle dense dark :model-value="assignment.isNameSlot" label="VarName"
              @update:model-value="val => updateField(assignment, 'isNameSlot', val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="assignment.declareType" :disable="assignment.isNameSlot"
              @update:model-value="val => updateField(assignment, 'declareType', val)" :options="declareTypeOptions"
              emit-value map-options class="col-auto">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined :model-value="assignment.varName"
              @update:model-value="val => updateField(assignment, 'varName', val)" class="col"
              :disable="assignment.isNameSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    变量名称<br />
                    示例: myVar, userData, result
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- 值输入行: toggle → 输入框 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="assignment.isValueSlot" label="Value"
              @update:model-value="val => updateField(assignment, 'isValueSlot', val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined :model-value="assignment.slotValue"
              @update:model-value="val => updateField(assignment, 'slotValue', val)" class="col"
              :disable="assignment.isValueSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    初始值表达式<br />
                    示例: "hello", 42, [], {}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 添加按钮 -->
      <q-btn dense flat no-caps label="Add" class="q-mt-xs full-width" color="primary" @click="addAssignment" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
