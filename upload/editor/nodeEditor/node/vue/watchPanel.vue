<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 模式切换卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle
              dense
              dark
              label="watchEffect"
              :model-value="properties.useWatchEffect"
              @update:model-value="toggleMode"
              style="min-width: 120px; flex-shrink: 0;"
            />
            <span class="text-caption text-grey">
              {{ properties.useWatchEffect ? '自动追踪依赖' : '显式指定监听源' }}
            </span>
          </div>
        </q-card-section>
      </q-card>

      <!-- Watch 模式：监听源卡片 -->
      <q-card v-if="!properties.useWatchEffect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-sm">Watch Sources</div>

          <div
            v-for="(source, index) in properties.sources"
            :key="source.id"
            class="q-mb-sm"
            style="position: relative;"
          >
            <div
              class="q-pa-sm rounded-borders"
              style="border: 1px solid #444; padding-right: 48px;"
            >
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle
                  dense
                  dark
                  :label="`[${index}]`"
                  :model-value="source.isSlot"
                  @update:model-value="val => updateSourceSlot(index, val)"
                  style="min-width: 50px; flex-shrink: 0;"
                />
                <q-toggle
                  v-if="source.isSlot"
                  dense
                  dark
                  label="Func"
                  :model-value="source.isFunction"
                  @update:model-value="val => updateSourceFunction(index, val)"
                  style="min-width: 60px; flex-shrink: 0;"
                />
                <q-input
                  v-if="!source.isSlot"
                  dense
                  dark
                  outlined
                  class="col"
                  :model-value="source.value"
                  @update:model-value="val => updateSourceValue(index, val)"
                  placeholder="countRef"
                >
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        监听的响应式数据源<br />
                        示例: countRef, () => state.count
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
            </div>

            <q-btn
              flat
              dense
              size="sm"
              icon="close"
              color="negative"
              @click="removeSource(index)"
              style="position: absolute; right: 8px; top: 8px;"
            />
          </div>

          <q-btn
            flat
            dense
            size="sm"
            icon="add"
            label="Add Source"
            color="primary"
            @click="addSource"
          />
        </q-card-section>
      </q-card>

      <!-- Watch 模式：选项卡片 -->
      <q-card v-if="!properties.useWatchEffect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-sm">Options</div>
          <div class="column q-gutter-y-xs">
            <q-checkbox
              dense
              dark
              :model-value="properties.options?.deep"
              @update:model-value="val => updateField('options.deep', val)"
              label="deep"
            />
            <q-checkbox
              dense
              dark
              :model-value="properties.options?.immediate"
              @update:model-value="val => updateField('options.immediate', val)"
              label="immediate"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- 提示信息 -->
      <div class="text-center text-caption text-grey">
        Connect a FunctionBlock to the 'effect' input.
      </div>
    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

// 数据绑定
const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 通用字段更新
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 模式切换
function toggleMode(useWatchEffect) {
  properties.value.useWatchEffect = useWatchEffect;

  if (useWatchEffect) {
    // 切换到 watchEffect 模式：移除所有 source slots
    const node = props.value;
    properties.value.sources?.forEach((source) => {
      const slotIndex = node.inputs.findIndex(i => i.id === source.id);
      if (slotIndex !== -1) {
        node.removeInput(slotIndex);
      }
    });
  } else {
    // 切换到 watch 模式：恢复 source slots
    const node = props.value;
    properties.value.sources?.forEach((source, index) => {
      if (source.isSlot) {
        const existingSlot = node.inputs.find(i => i.id === source.id);
        if (!existingSlot) {
          addSourceSlot(node, source, index);
        }
      }
    });
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 添加 source slot 的辅助函数
function addSourceSlot(node, source, index) {
  const slotName = source.value || `source-${index}`;
  if (source.isFunction) {
    node.addInput(slotName, 'function', {
      id: source.id,
      shape: 5,
      meta: { args: [] },
    });
  } else {
    node.addInput(slotName, 'string', { id: source.id });
  }
}

// Source 管理
function addSource() {
  if (!properties.value.sources) {
    properties.value.sources = [];
  }
  const newSource = { id: uid(), value: '', isSlot: true, isFunction: false };
  properties.value.sources.push(newSource);

  const node = props.value;
  const index = properties.value.sources.length - 1;
  addSourceSlot(node, newSource, index);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeSource(index) {
  const sourceToRemove = properties.value.sources[index];
  const node = props.value;

  const slotIndex = node.inputs.findIndex(i => i.id === sourceToRemove.id);
  if (slotIndex !== -1) {
    node.removeInput(slotIndex);
  }

  properties.value.sources.splice(index, 1);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateSourceSlot(index, isSlot) {
  const source = properties.value.sources[index];
  if (!source) return;

  source.isSlot = isSlot;
  const node = props.value;
  const existingSlot = node.inputs.find(i => i.id === source.id);

  if (isSlot && !existingSlot) {
    addSourceSlot(node, source, index);
  } else if (!isSlot && existingSlot) {
    const slotIndex = node.inputs.indexOf(existingSlot);
    node.removeInput(slotIndex);
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateSourceFunction(index, isFunction) {
  const source = properties.value.sources[index];
  if (!source || !source.isSlot) return;

  const node = props.value;

  const existingSlotIndex = node.inputs.findIndex(i => i.id === source.id);
  if (existingSlotIndex !== -1) {
    node.removeInput(existingSlotIndex);
  }

  source.isFunction = isFunction;
  addSourceSlot(node, source, index);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateSourceValue(index, value) {
  const source = properties.value.sources[index];
  if (!source) return;

  source.value = value;

  if (source.isSlot) {
    const node = props.value;
    const slot = node.inputs.find(i => i.id === source.id);
    if (slot) {
      slot.name = value || `source-${index}`;
    }
  }

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>
