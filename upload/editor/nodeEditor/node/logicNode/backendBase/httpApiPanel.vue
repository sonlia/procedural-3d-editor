<script setup>
import { computed } from 'vue';
import { uid } from 'quasar';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

const methodOptions = ['GET', 'POST', 'PUT', 'DELETE'];
const execModeOptions = [
  { label: '被动调用', value: 'manual' },
  { label: '自动执行', value: 'auto' },
];

// === HTTP 配置 ===
function updateMethod(val) {
  properties.value.method = val;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updateRoutePath(val) {
  properties.value.routePath = val;
  properties.value.autoRoute = false;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function toggleAutoRoute(val) {
  properties.value.autoRoute = val;
  if (val) properties.value.routePath = '';
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updateExecMode(val) {
  properties.value.execMode = val;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// === 传入参数管理（= request.body 字段）===
function addPassIn() {
  const newParam = {
    id: uid(),
    name: `param${properties.value.passIn?.length || 0}`,
  };
  if (!properties.value.passIn) properties.value.passIn = [];
  properties.value.passIn.push(newParam);
  // valueMode:'label' — 子图代码在后端 destructure 出 slot.name,子图内必须引用 slot.name
  props.value?.addInput(newParam.name, 'string', { id: newParam.id, isPassIn: true, valueMode: 'label' });
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function removePassIn(paramId, index) {
  const existingIndex = props.value?.inputs?.findIndex(i => i.id === paramId);
  if (existingIndex !== -1) props.value.removeInput(existingIndex);
  properties.value.passIn.splice(index, 1);
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updatePassInName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value?.inputs?.find(i => i.id === param.id);
  if (slot) slot.name = newName;
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// === 传出参数管理（= 后端返回字段 = 外部 ref 输出）===
function addPassOut() {
  const newParam = {
    id: uid(),
    name: `out${properties.value.passOut?.length || 0}`,
  };
  if (!properties.value.passOut) properties.value.passOut = [];
  properties.value.passOut.push(newParam);
  // output 不挂 valueMode:'label' —— 节点 onExecute 末尾 setOutputData 写 `${funcName}_${name}.value`,
  // 挂 label 会被 prototype wrapper 覆盖成裸 slot.name 丢掉 `.value`,前端下游拿到 ref 对象本身。
  props.value?.addOutput(newParam.name, 'string', { id: newParam.id });
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function removePassOut(paramId, index) {
  const existingIndex = props.value?.outputs?.findIndex(o => o.id === paramId);
  if (existingIndex !== -1) props.value.removeOutput(existingIndex);
  properties.value.passOut.splice(index, 1);
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updatePassOutName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value?.outputs?.find(o => o.id === param.id);
  if (slot) slot.name = newName;
  props.value?.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">

      <!-- HTTP 配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5">HTTP 配置</div>

          <div class="row q-gutter-x-sm q-mt-xs">
            <q-select
              dense dark outlined
              class="col-4"
              :model-value="properties.method"
              :options="methodOptions"
              @update:model-value="updateMethod"
              label="Method"
            />
            <q-input
              dense dark outlined
              class="col"
              :model-value="properties.routePath"
              @update:model-value="updateRoutePath"
              :placeholder="properties.autoRoute ? '自动生成' : '/api/your/path'"
              :disable="properties.autoRoute"
            />
          </div>

          <q-toggle
            dense dark
            :model-value="properties.autoRoute"
            @update:model-value="toggleAutoRoute"
            label="自动路由"
            class="q-mt-xs"
          />

          <q-select
            dense dark outlined
            class="q-mt-xs"
            :model-value="properties.execMode"
            :options="execModeOptions"
            @update:model-value="val => updateExecMode(val.value || val)"
            emit-value
            map-options
            label="执行模式"
          />
        </q-card-section>
      </q-card>

      <!-- 请求参数（passIn = request.body 字段）-->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5">请求参数 ({{ properties.method === 'GET' ? 'request.query' : 'request.body' }})</div>
          <div
            v-for="(p, index) in (properties.passIn || [])"
            :key="p.id"
            class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
          >
            <q-input
              dense dark outlined
              class="col"
              :model-value="p.name"
              @update:model-value="val => updatePassInName(p, val)"
              placeholder="字段名"
            />
            <q-btn flat dense icon="close" color="negative" @click="removePassIn(p.id, index)" />
          </div>
          <q-btn dense flat no-caps label="+ 添加参数" @click="addPassIn" class="q-mt-sm full-width" color="primary" />
        </q-card-section>
      </q-card>

      <!-- 返回字段（passOut = 后端返回 → 前端 ref）-->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5">返回字段 (response)</div>
          <div
            v-for="(p, index) in (properties.passOut || [])"
            :key="p.id"
            class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
          >
            <q-input
              dense dark outlined
              class="col"
              :model-value="p.name"
              @update:model-value="val => updatePassOutName(p, val)"
              placeholder="字段名"
            />
            <q-btn flat dense icon="close" color="negative" @click="removePassOut(p.id, index)" />
          </div>
          <q-btn dense flat no-caps label="+ 添加字段" @click="addPassOut" class="q-mt-sm full-width" color="primary" />
        </q-card-section>
      </q-card>

      <!-- SSE 通知配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-toggle
            v-model="properties.notifyOnSuccess"
            label="成功时也提示"
            dense
            dark
            color="positive"
          />
          <div class="text-caption text-grey-6">
            失败始终通知，开启后成功请求也会弹出提示
          </div>
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>
