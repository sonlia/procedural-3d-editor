<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- 分区 1：输出变量 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox
            dense
            dark
            :model-value="properties.exported"
            :disable="properties.varName?.isSlot"
            @update:model-value="val => updateField('exported', val)"
            label="Export"
            class="q-mb-xs"
          />
          <!-- 变量声明行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName"
              :model-value="properties.varName?.isSlot"
              @update:model-value="val => updateVarNameSlot(val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select
              dense
              dark
              outlined
              :model-value="properties.declareType"
              :disable="properties.varName?.isSlot"
              @update:model-value="val => updateField('declareType', val)"
              :options="declareTypeOptions"
              emit-value
              map-options
              class="col-auto"
              style="min-width: 70px;"
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
            <q-input dense dark outlined class="col"
              :model-value="properties.varName?.value"
              :disable="properties.varName?.isSlot"
              @update:model-value="val => updateField('varName.value', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    异步组件的变量名<br />
                    示例: AsyncComp, LazyDialog
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 2：Loader 配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">Loader</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="Loader"
              :model-value="properties.useLoaderSlot"
              @update:model-value="val => updateSlot('loader', properties.loaderSlotId, val, 'useLoaderSlot')"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col"
              :model-value="properties.importPath"
              :disable="properties.useLoaderSlot"
              @update:model-value="val => updateField('importPath', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="280px">
                    import() 路径，需自行添加引号<br />
                    示例: './Foo.vue'<br />
                    必须使用相对路径 + 完整扩展名
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 3：Options 配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">Options</div>

          <!-- loadingComponent -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="Loading"
              :model-value="properties.options?.loadingComponentIsSlot"
              @update:model-value="val => updateSlot('loadingComponent', properties.options?.loadingComponentSlotId, val, 'options.loadingComponentIsSlot')"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col"
              :model-value="properties.options?.loadingComponent"
              :disable="properties.options?.loadingComponentIsSlot"
              @update:model-value="val => updateField('options.loadingComponent', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    加载中显示的组件<br />
                    示例: LoadingSpinner
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- errorComponent -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mt-xs">
            <q-toggle dense dark label="Error"
              :model-value="properties.options?.errorComponentIsSlot"
              @update:model-value="val => updateSlot('errorComponent', properties.options?.errorComponentSlotId, val, 'options.errorComponentIsSlot')"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col"
              :model-value="properties.options?.errorComponent"
              :disable="properties.options?.errorComponentIsSlot"
              @update:model-value="val => updateField('options.errorComponent', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    加载失败显示的组件<br />
                    示例: ErrorFallback
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <q-separator dark class="q-my-sm" />

          <!-- delay & timeout -->
          <div class="row q-col-gutter-sm">
            <div class="col-6">
              <q-input dense dark outlined
                :model-value="properties.options?.delay"
                @update:model-value="val => updateField('options.delay', val)"
                label="delay(ms)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="200px">
                      显示 loading 前的延迟时间<br />
                      默认: 200ms
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-6">
              <q-input dense dark outlined
                :model-value="properties.options?.timeout"
                @update:model-value="val => updateField('options.timeout', val)"
                label="timeout(ms)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="200px">
                      加载超时时间，超时显示 error<br />
                      默认: 3000ms
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed } from 'vue';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

// 1. 数据绑定
const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 声明类型选项
const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
];

// 2. 响应式更新
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 3. VarName slot 管理（三元组结构）
function updateVarNameSlot(isSlot) {
  const varName = properties.value.varName;
  if (!varName) return;

  varName.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(s => s.id === varName.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: varName.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 4. 通用 slot 管理
function updateSlot(slotName, slotId, isSlot, propertyKey) {
  set(properties.value, propertyKey, isSlot);
  const existingIdx = props.value.inputs.findIndex(s => s.id === slotId);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>

<style scoped></style>
