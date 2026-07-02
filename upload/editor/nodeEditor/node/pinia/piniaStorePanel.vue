<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Store 配置卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox
            dense
            dark
            :model-value="properties.exported"
            @update:model-value="(val) => updateField('exported', val)"
            label="Export"
            class="q-mb-xs"
          />

          <!-- Store Name -->
          <div class="q-mt-xs">
            <q-input
              dense
              dark
              outlined
              :model-value="properties.name"
              @update:model-value="(val) => updateField('name', val)"
              label="Store Name"
              placeholder="counter"
            >
              <template v-slot:append>
                <q-icon name="help_outline" class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    Store 的名称，用于 defineStore 的第一个参数<br />
                    示例: counter, user, cart
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- Store Variable (只读显示) -->
          <div class="q-mt-xs">
            <q-input
              dense
              dark
              outlined
              readonly
              :model-value="storeVar"
              label="Store Variable (auto-generated)"
            >
              <template v-slot:append>
                <q-icon name="help_outline" class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    自动生成的 store 变量名<br />
                    规则: use + Name(首字母大写) + Store<br />
                    示例: useCounterStore, useUserStore
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 子图内节点列表 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">
            子图内的成员 ({{ totalMembers }}):
          </div>

          <!-- State 列表 -->
          <div v-if="stateNodes.length > 0" class="q-mt-sm">
            <div class="text-caption text-grey-6 q-mb-xs">State ({{ stateNodes.length }}):</div>
            <q-list dense dark>
              <q-item v-for="node in stateNodes" :key="node.id">
                <q-item-section>
                  <q-item-label caption>{{ node.name }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Getters 列表 -->
          <div v-if="getterNodes.length > 0" class="q-mt-sm">
            <div class="text-caption text-grey-6 q-mb-xs">Getters ({{ getterNodes.length }}):</div>
            <q-list dense dark>
              <q-item v-for="node in getterNodes" :key="node.id">
                <q-item-section>
                  <q-item-label caption>{{ node.name }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Actions 列表 -->
          <div v-if="actionNodes.length > 0" class="q-mt-sm">
            <div class="text-caption text-grey-6 q-mb-xs">Actions ({{ actionNodes.length }}):</div>
            <q-list dense dark>
              <q-item v-for="node in actionNodes" :key="node.id">
                <q-item-section>
                  <q-item-label caption>{{ node.name }}{{ node.params }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- 空状态提示 -->
          <div v-if="totalMembers === 0" class="text-caption text-grey-6 q-mt-sm">
            子图内暂无可导出的节点。双击进入子图添加节点。
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 计算 storeVar
const storeVar = computed(() => {
  const name = properties.value.name || "store";
  return `use${name.charAt(0).toUpperCase() + name.slice(1)}Store`;
});

// 从 properties.collectedNodes 读取（在 onExecute 中更新）
const stateNodes = computed(() => {
  return properties.value.collectedNodes?.state || [];
});

const getterNodes = computed(() => {
  return properties.value.collectedNodes?.getters || [];
});

const actionNodes = computed(() => {
  return properties.value.collectedNodes?.actions || [];
});

const totalMembers = computed(() => {
  return stateNodes.value.length + getterNodes.value.length + actionNodes.value.length;
});

// 更新字段
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>
