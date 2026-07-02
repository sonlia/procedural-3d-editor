<script setup>
import { computed } from 'vue';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';
import { parseFunctionSignature } from '../logicNode/utils.js';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});

// 声明类型选项
const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
];

// 触发节点更新
function triggerNodeUpdate() {
  const node = props.value;
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 统一更新函数
function updateField(key, value) {
  set(properties.value, key, value);
  triggerNodeUpdate();
}

// 管理 VarName slot（三元组）
function updateVarNameSlot(isSlot) {
  const node = props.value;
  const outputVar = properties.value.outputVar;
  outputVar.isSlot = isSlot;

  const existingIdx = node.inputs.findIndex(i => i.id === outputVar.id);

  if (isSlot && existingIdx === -1) {
    node.addInput('VarName', 'string', { id: outputVar.id });
  } else if (!isSlot && existingIdx !== -1) {
    node.removeInput(existingIdx);
  }
  triggerNodeUpdate();
}

// 管理函数 slot（get/set）
function updateFunctionSlot(funcParam, isSlot) {
  const node = props.value;
  funcParam.isSlot = isSlot;

  const existingIdx = node.inputs.findIndex(s => s.id === funcParam.id);

  if (isSlot && existingIdx === -1) {
    const { name, args } = parseFunctionSignature(funcParam.label);
    node.addInput(name, 'function', {
      id: funcParam.id,
      shape: 5,
      meta: { args }
    });
  } else if (!isSlot && existingIdx !== -1) {
    node.removeInput(existingIdx);
  }
  triggerNodeUpdate();
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 变量名配置卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox
            dense
            dark
            :model-value="properties.exported"
            :disable="properties.outputVar?.isSlot"
            @update:model-value="val => updateField('exported', val)"
            label="Export"
            class="q-mb-xs"
          />

          <!-- 变量声明行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle
              dense
              dark
              label="VarName"
              :model-value="properties.outputVar?.isSlot"
              @update:model-value="updateVarNameSlot"
              style="min-width: 90px; flex-shrink: 0;"
            />
            <q-select
              dense
              dark
              outlined
              :model-value="properties.declareType"
              :disable="properties.outputVar?.isSlot"
              @update:model-value="val => updateField('declareType', val)"
              :options="declareTypeOptions"
              emit-value
              map-options
              class="col-auto"
              style="min-width: 80px;"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input
              dense
              dark
              outlined
              class="col"
              :model-value="properties.outputVar?.value"
              :disable="properties.outputVar?.isSlot"
              @update:model-value="val => updateField('outputVar.value', val)"
              placeholder="myComputed"
            >
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    computed 变量的名称<br />
                    示例: myComputed, userName, totalPrice
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 函数配置卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">函数配置</div>

          <!-- get() 函数 -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
            <q-toggle
              dense
              dark
              :model-value="properties.getFunc?.isSlot"
              @update:model-value="val => updateFunctionSlot(properties.getFunc, val)"
              style="min-width: 90px; flex-shrink: 0;"
            />
            <span class="text-caption text-grey-4" style="min-width: 100px;">{{ properties.getFunc?.label }}</span>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="250px">
                getter 函数，返回计算值<br />
                连接 FunctionBlock 提供函数体
              </q-tooltip>
            </q-icon>
          </div>

          <q-separator dark class="q-my-sm" />

          <!-- set(newValue) 函数 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle
              dense
              dark
              :model-value="properties.setFunc?.isSlot"
              @update:model-value="val => updateFunctionSlot(properties.setFunc, val)"
              style="min-width: 90px; flex-shrink: 0;"
            />
            <span class="text-caption text-grey-4" style="min-width: 100px;">{{ properties.setFunc?.label }}</span>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="250px">
                setter 函数，设置计算值<br />
                可选，不连接则为只读 computed<br />
                连接 FunctionBlock 提供函数体
              </q-tooltip>
            </q-icon>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
