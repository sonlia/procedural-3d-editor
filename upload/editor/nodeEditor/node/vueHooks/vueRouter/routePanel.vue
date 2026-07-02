<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isRoute = computed(() => nodeType.value === "useRoute");
const isRouter = computed(() => nodeType.value === "useRouter");

const hookDescription = computed(() => {
  if (isRoute.value) return "获取当前路由对象，包含 path、query、params 等信息";
  if (isRouter.value) return "获取路由实例，用于编程式导航";
  return "";
});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
  if (!param) return;
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

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">{{ hookDescription }}</div>

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
                    {{ isRoute ? '路由对象变量名' : '路由实例变量名' }}<br />
                    示例: {{ isRoute ? 'route, currentRoute' : 'router' }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：输出说明（仅 useRoute） -->
      <q-card v-if="isRoute" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">path</span> - 当前路径</div>
            <div><span class="text-blue-4">fullPath</span> - 完整路径（含 query）</div>
            <div><span class="text-blue-4">query</span> - 查询参数对象</div>
            <div><span class="text-blue-4">params</span> - 路由参数对象</div>
            <div><span class="text-blue-4">name</span> - 路由名称</div>
            <div><span class="text-blue-4">meta</span> - 路由元信息</div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：方法说明（仅 useRouter） -->
      <q-card v-if="isRouter" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">常用方法</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">push(to)</span> - 导航到新路由</div>
            <div><span class="text-blue-4">replace(to)</span> - 替换当前路由</div>
            <div><span class="text-blue-4">go(n)</span> - 前进/后退 n 步</div>
            <div><span class="text-blue-4">back()</span> - 后退一步</div>
            <div><span class="text-blue-4">forward()</span> - 前进一步</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
