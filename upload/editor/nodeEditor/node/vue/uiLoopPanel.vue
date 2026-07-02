<script setup>
import { ref, watch, onMounted } from 'vue';
import { cloneDeep, isEqual } from 'lodash-es';
import BasePropertyPanel from '../../propertyPanel/BasePropertyPanel.vue';

const node = defineModel(); // node 实例

// 默认属性
const defaultProperties = () => ({
  itemVar: 'item',
  indexVar: 'index',
  keyExpression: 'index',
  itemVarSlotId: '', // 由节点初始化时生成
  indexVarSlotId: '', // 由节点初始化时生成
  // items 数据源配置
  itemsValue: '', // 直接输入的值
  itemsIsSlot: false, // 默认使用 slot 连接
});

const localProperties = ref(defaultProperties());

// 初始化
onMounted(() => {
  const initialProps = {
    ...defaultProperties(),
    ...cloneDeep(node.value?.properties ?? {})
  };

  if (!isEqual(localProperties.value, initialProps)) {
    localProperties.value = initialProps;
  }

  if (!isEqual(node.value.properties, localProperties.value)) {
    node.value.properties = cloneDeep(localProperties.value);
  }
});

// 监听本地属性变化，同步到节点
watch(localProperties, (newVal) => {
  if (!isEqual(node.value.properties, newVal)) {
    node.value.properties = cloneDeep(newVal);

    // 批量更新输出 slot 名称
    syncSlotNames();
  }
}, { deep: true });

// 监听节点属性变化（外部修改）
watch(() => node.value?.properties, (newVal) => {
  const newProps = {
    ...defaultProperties(),
    ...cloneDeep(newVal ?? {})
  };
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}, { deep: true });

// 使用节点实例方法批量更新 slot 名称
function syncSlotNames() {
  const { itemVarSlotId, indexVarSlotId, itemVar, indexVar } = localProperties.value;

  node.value.batchUpdateSlotNames([
    { slotId: itemVarSlotId, name: itemVar || 'item' },
    { slotId: indexVarSlotId, name: indexVar || 'index' },
  ]);
}

// 处理 items isSlot 切换
function handleItemsSlotToggle(isSlot) {
  localProperties.value.itemsIsSlot = isSlot;

  const slotName = 'items';
  const slotIndex = node.value.inputs?.findIndex(slot => slot.name === slotName) ?? -1;

  if (isSlot && slotIndex === -1) {
    // 启用 slot：添加 input slot
    node.value.addInput(slotName, 'string');
  } else if (!isSlot && slotIndex !== -1) {
    // 禁用 slot：移除 input slot
    node.value.removeInput(slotIndex);
  }

  // 触发节点更新
  if (node.value.onExecute && typeof node.value.onExecute === 'function') {
    node.value.onExecute();
  }
}
</script>

<template>
  <BasePropertyPanel v-model="node" code-filename="ui-loop-config.js">

    <!-- 数据源配置 -->
    <q-card dark flat bordered class="q-mb-sm">
      <q-card-section class="q-pa-sm">
        <div class="text-caption text-grey-5 q-mb-sm">数据源</div>

        <!-- items 输入配置 -->
        <div class="items-input-row">
          <!-- isSlot 切换 -->
          <q-toggle icon="code" :model-value="localProperties.itemsIsSlot" @update:model-value="handleItemsSlotToggle"
            color="teal" dense class="toggle-switch">
            <q-tooltip anchor="top middle" self="bottom middle" :delay="800">
              {{ localProperties.itemsIsSlot ? '使用直接输入' : '使用 Slot 连接' }}
            </q-tooltip>
          </q-toggle>

          <!-- items 输入框 -->
          <q-input v-model="localProperties.itemsValue" label="循环数据 (items)" placeholder="dataList"
            :disable="localProperties.itemsIsSlot" dense dark outlined debounce="100" class="flex-grow"
            :class="{ 'input-disabled': localProperties.itemsIsSlot }">
          </q-input>
        </div>
      </q-card-section>
    </q-card>

    <!-- 配置区域 -->
    <q-card dark flat bordered class="q-mb-sm">
      <q-card-section class="q-pa-sm">
        <div class="text-caption text-grey-5 q-mb-sm">循环变量配置</div>

        <!-- 循环项变量名 -->
        <q-input :id="localProperties.itemVarSlotId" v-model="localProperties.itemVar" label="循环项变量名" placeholder="item"
          dense dark outlined class="q-mb-sm">

          <template v-slot:append>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="250px">
                循环中每一项的变量名<br />
                示例: item, user, product
              </q-tooltip>
            </q-icon>
          </template>
        </q-input>

        <!-- 索引变量名 -->
        <q-input :id="localProperties.indexVarSlotId" v-model="localProperties.indexVar" label="索引变量名"
          placeholder="index" dense dark outlined class="q-mb-sm">

          <template v-slot:append>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="250px">
                循环索引的变量名<br />
                示例: index, i, idx
              </q-tooltip>
            </q-icon>
          </template>
        </q-input>

        <!-- Key 表达式 -->
        <q-input v-model="localProperties.keyExpression" label=":key 表达式" placeholder="index" dense dark outlined>

          <template v-slot:append>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="250px">
                用于 Vue :key 的表达式<br />
                推荐使用唯一 ID，如 item.id<br />
                默认使用 index
              </q-tooltip>
            </q-icon>
          </template>
        </q-input>
      </q-card-section>
    </q-card>


  </BasePropertyPanel>
</template>

<style scoped>
code {
  font-family: 'Courier New', monospace;
  font-size: 0.75em;
  border-radius: 3px;
  display: inline-block;
}

.items-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-switch {
  flex-shrink: 0;
}

.flex-grow {
  flex: 1;
}

.input-disabled {
  opacity: 0.6;
}
</style>
