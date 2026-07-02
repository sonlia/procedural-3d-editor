<script setup>
import { computed } from 'vue';
import { uid } from 'quasar';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';
import { useProjectStore } from 'src/stores/projectMange.js';
import { collectSubgraphCode } from 'src/components/editor/codeStrategies/shared/subgraphCollector.js';

// 与 backendFunctionPanel 相同的数据绑定模式
const props = defineModel();

// 单一数据源模式
const properties = computed(() => props.value?.properties || {});

const projectStore = useProjectStore();

const generatedCodePreview = computed(() => {
  const node = props.value;
  if (!node) return '// 请配置数据库连接';

  void properties.value;

  let outer = node.bgJsCode || node.jsCode || '';
  if (!outer) return '// 节点未生成代码（请检查配置）';

  if (node.subgraph) {
    const body = collectSubgraphCode(node.subgraph, new Map());
    outer = outer.replaceAll(`__SUBGRAPH_${node.id}__`, body || '// 子图为空');
  }

  return outer;
});

// ─── 数据库连接选择器 ───

// 从 dbTree 中提取 type === "dbbase" 的数据库连接节点
const flatDbTree = computed(() => projectStore.currentProject?.database?.dbTree || []);

const dbConnectionList = computed(() =>
  flatDbTree.value
    .filter(node => node.type === 'dbbase')
    .map(node => ({ label: node.name, value: node.id }))
);

function onDbConnectionChange(dbId) {
  if (!properties.value) return;
  properties.value.dbConnectionId = dbId;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// ─── 事务模式 ───

function onTransactionChange(val) {
  if (!properties.value) return;
  properties.value.transaction = val;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// === 传入参数管理函数（数据流入节点）===
function addPassIn() {
  const newParam = {
    id: uid(),
    name: `in${properties.value.passIn?.length || 0}`
  };

  if (!properties.value.passIn) {
    properties.value.passIn = [];
  }
  properties.value.passIn.push(newParam);
  props.value?.addInput(newParam.name, 'string', { id: newParam.id, isPassIn: true });
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function removePassIn(paramId, index) {
  const existingIndex = props.value?.inputs?.findIndex(i => i.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
  properties.value.passIn.splice(index, 1);
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updatePassInName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value?.inputs?.find(i => i.id === param.id);
  if (slot) {
    slot.name = newName;
  }
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// === 传出参数管理函数（数据流出节点）===
function addPassOut() {
  const newParam = {
    id: uid(),
    name: `out${properties.value.passOut?.length || 0}`
  };

  if (!properties.value.passOut) {
    properties.value.passOut = [];
  }
  properties.value.passOut.push(newParam);
  props.value?.addOutput(newParam.name, 'string', { id: newParam.id });
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function removePassOut(paramId, index) {
  const existingIndex = props.value?.outputs?.findIndex(o => o.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeOutput(existingIndex);
  }
  properties.value.passOut.splice(index, 1);
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updatePassOutName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value?.outputs?.find(o => o.id === param.id);
  if (slot) {
    slot.name = newName;
  }
  props.value?.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <!-- 分区 1：数据库配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">数据库配置</div>

          <q-select
            dense dark outlined
            :model-value="properties.dbConnectionId"
            @update:model-value="onDbConnectionChange"
            :options="dbConnectionList"
            label="数据库连接"
            emit-value
            map-options
            class="q-mb-xs"
          />

          <q-toggle
            dense dark
            :model-value="properties.transaction"
            @update:model-value="onTransactionChange"
            label="事务模式"
          >
            <q-tooltip class="bg-dark" max-width="250px">
              开启后，内部所有 Table 节点操作将包裹在同一事务中
            </q-tooltip>
          </q-toggle>
        </q-card-section>
      </q-card>

      <!-- 分区 2：传入 / 传出参数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- 传入列表（数据流入节点）-->
          <div>
            <div class="text-caption text-grey-5">传入</div>
            <div
              v-for="(p, index) in (properties.passIn || [])"
              :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
            >
              <q-input
                dense
                dark
                outlined
                class="col"
                :model-value="p.name"
                @update:model-value="val => updatePassInName(p, val)"
                placeholder="变量名"
              >
                <template v-slot:append>
                  <q-icon name="help_outline" class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      从外部传入的变量名<br />
                      示例: db, config, request
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn flat dense icon="close" color="negative" @click="removePassIn(p.id, index)" />
            </div>
            <q-btn dense flat no-caps label="+ 添加传入" @click="addPassIn" class="q-mt-sm full-width" color="primary" />
          </div>

          <q-separator dark class="q-my-sm" />

          <!-- 传出列表（数据流出节点）-->
          <div>
            <div class="text-caption text-grey-5">传出</div>
            <div
              v-for="(p, index) in (properties.passOut || [])"
              :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
            >
              <q-input
                dense
                dark
                outlined
                class="col"
                :model-value="p.name"
                @update:model-value="val => updatePassOutName(p, val)"
                placeholder="变量名"
              >
                <template v-slot:append>
                  <q-icon name="help_outline" class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      传出到外部的变量名<br />
                      示例: result, response, data
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn flat dense icon="close" color="negative" @click="removePassOut(p.id, index)" />
            </div>
            <q-btn dense flat no-caps label="+ 添加传出" @click="addPassOut" class="q-mt-sm full-width" color="primary" />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
