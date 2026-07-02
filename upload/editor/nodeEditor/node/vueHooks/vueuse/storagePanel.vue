<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断是否是 sessionStorage 节点
const isSessionStorage = computed(() => {
  return props.value?.constructor?.title === "useSessionStorage";
});

const storageType = computed(() => isSessionStorage.value ? "sessionStorage" : "localStorage");

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(param.label || "value", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("VarName", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateKeySlot(isSlot) {
  const param = properties.value.key;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("key", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateInitialValueSlot(isSlot) {
  const param = properties.value.initialValue;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("initialValue", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 卡片 1：输出变量 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark label="Export" :disable="properties.outputVar?.isSlot"
            :model-value="properties.exported"
            @update:model-value="v => updateField('exported', v)" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName"
              :model-value="properties.outputVar?.isSlot"
              @update:model-value="v => updateVarNameSlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :disable="properties.outputVar?.isSlot"
              :model-value="properties.declareType"
              @update:model-value="v => updateField('declareType', v)"
              :options="declareTypeOptions" emit-value map-options class="col-auto">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :disable="properties.outputVar?.isSlot"
              :model-value="properties.outputVar?.value"
              @update:model-value="v => updateField('outputVar.value', v)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    响应式 {{ storageType }} 引用变量名<br />
                    示例: userSettings, theme, token
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：存储键名 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">存储键名 (key)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="Key"
              :model-value="properties.key?.isSlot"
              @update:model-value="v => updateKeySlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.key?.isSlot"
              :model-value="properties.key?.value"
              @update:model-value="v => updateField('key.value', v)"
              placeholder="'my-key'">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    {{ storageType }} 中的键名<br />
                    示例: 'user-settings', 'theme', `user-${id}`
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：初始值 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">初始值 (initialValue)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="Value"
              :model-value="properties.initialValue?.isSlot"
              @update:model-value="v => updateInitialValueSlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.initialValue?.isSlot"
              :model-value="properties.initialValue?.value"
              @update:model-value="v => updateField('initialValue.value', v)"
              placeholder="null">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    存储不存在时的默认值<br />
                    示例: null, {}, [], 'default'
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <div class="column q-gutter-y-xs">
            <q-checkbox dense dark
              :model-value="properties.listenToStorageChanges"
              @update:model-value="v => updateField('listenToStorageChanges', v)"
              label="监听存储变化">
              <q-tooltip class="bg-dark" max-width="250px">
                监听其他标签页的存储变化
              </q-tooltip>
            </q-checkbox>
            <q-checkbox dense dark
              :model-value="properties.writeDefaults"
              @update:model-value="v => updateField('writeDefaults', v)"
              label="写入默认值">
              <q-tooltip class="bg-dark" max-width="250px">
                存储不存在时写入初始值
              </q-tooltip>
            </q-checkbox>
            <q-checkbox dense dark
              :model-value="properties.mergeDefaults"
              @update:model-value="v => updateField('mergeDefaults', v)"
              label="合并默认值">
              <q-tooltip class="bg-dark" max-width="250px">
                读取时将存储值与默认值合并
              </q-tooltip>
            </q-checkbox>
            <q-checkbox dense dark
              :model-value="properties.shallow"
              @update:model-value="v => updateField('shallow', v)"
              label="浅层响应式">
              <q-tooltip class="bg-dark" max-width="250px">
                使用 shallowRef 代替 ref
              </q-tooltip>
            </q-checkbox>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
