<template>
  <div class="column q-pa-sm q-gutter-y-sm">
    <!-- 组件选项:Vue3 通用内建选项 -->
    <q-card dark flat bordered>
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="settings" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1">组件选项</div>
        </div>
        <q-input v-model="componentName" dark dense outlined label="组件名 (name)" placeholder="如 MyCard"
          class="q-mb-sm" @update:model-value="commit" />
        <q-toggle v-model="inheritAttrs" dense size="sm" color="teal" label="继承透传属性 (inheritAttrs)"
          @update:model-value="commit" />
        <div class="text-caption text-grey-6 q-mt-xs">
          关闭后非 prop 属性不自动落到根元素,生成 inheritAttrs: false
        </div>
      </q-card-section>
    </q-card>

    <!-- Props -->
    <q-card dark flat bordered>
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="tune" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1">对外属性 Props</div>
          <q-space />
          <q-btn dense flat round icon="playlist_add" size="sm" color="grey-5">
            <q-tooltip class="bg-dark">添加常见 prop</q-tooltip>
            <q-menu dark auto-close>
              <q-list dense style="min-width: 150px">
                <q-item v-for="cp in COMMON_PROPS" :key="cp.name" clickable @click="addCommonProp(cp)"
                  :disable="props.some((p) => p.name === cp.name)">
                  <q-item-section>{{ cp.name }}</q-item-section>
                  <q-item-section side class="text-grey-6">{{ cp.type }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
          <q-btn dense flat round icon="add" size="sm" color="primary" @click="addProp">
            <q-tooltip class="bg-dark">新增 prop</q-tooltip>
          </q-btn>
        </div>
        <div class="text-caption text-grey-6 q-mb-md">
          组件被父级使用时可传入的属性,生成 defineProps
        </div>

        <div v-if="!props.length" class="text-caption text-grey-7 q-py-sm">
          暂无属性,点击右上角 + 添加,或用 <q-icon name="playlist_add" size="xs" /> 选常见 prop
        </div>

        <div v-for="(p, i) in props" :key="i" class="row items-center q-col-gutter-xs q-mb-xs no-wrap">
          <div class="col">
            <q-input v-model="p.name" dark dense outlined placeholder="名称" @update:model-value="commit" />
          </div>
          <div class="col-auto" style="width: 96px">
            <q-select v-model="p.type" :options="TYPE_OPTIONS" dark dense outlined emit-value map-options
              @update:model-value="commit" />
          </div>
          <div class="col">
            <q-input v-model="p.default" dark dense outlined :placeholder="defaultHint(p.type)"
              :disable="p.type === 'Function'" @update:model-value="commit" />
          </div>
          <div class="col-auto">
            <q-toggle v-model="p.required" dense size="sm" color="teal" @update:model-value="commit">
              <q-tooltip class="bg-dark">必填</q-tooltip>
            </q-toggle>
          </div>
          <div class="col-auto">
            <q-btn dense flat round icon="close" size="sm" color="grey-6" @click="removeProp(i)" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Emits -->
    <q-card dark flat bordered>
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <q-icon name="bolt" size="sm" class="q-mr-sm" />
          <div class="text-subtitle1">对外事件 Emits</div>
          <q-space />
          <q-btn dense flat round icon="add" size="sm" color="primary" @click="addEmit">
            <q-tooltip class="bg-dark">新增事件</q-tooltip>
          </q-btn>
        </div>
        <div class="text-caption text-grey-6 q-mb-md">
          组件向父级派发的事件,生成 defineEmits
        </div>

        <div v-if="!emits.length" class="text-caption text-grey-7 q-py-sm">
          暂无事件,点击右上角 + 添加
        </div>

        <div v-for="(e, i) in emits" :key="i" class="row items-center q-col-gutter-xs q-mb-xs no-wrap">
          <div class="col">
            <q-input v-model="e.name" dark dense outlined placeholder="事件名" @update:model-value="commit" />
          </div>
          <div class="col-auto">
            <q-btn dense flat round icon="close" size="sm" color="grey-6" @click="removeEmit(i)" />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { runStep } from 'src/components/editor/nodeEditor/composables/useLitegraphEditor.js';

const panelProps = defineProps({
  graph: {
    type: Object,
    default: null
  }
});

const TYPE_OPTIONS = [
  { label: 'String', value: 'String' },
  { label: 'Number', value: 'Number' },
  { label: 'Boolean', value: 'Boolean' },
  { label: 'Array', value: 'Array' },
  { label: 'Object', value: 'Object' },
  { label: 'Function', value: 'Function' },
];

// 常见 prop 预置(点击快捷插入,非 Vue3 强制默认)
const COMMON_PROPS = [
  { name: 'modelValue', type: 'String' },
  { name: 'label', type: 'String' },
  { name: 'disable', type: 'Boolean', default: 'false' },
  { name: 'loading', type: 'Boolean', default: 'false' },
  { name: 'size', type: 'String' },
  { name: 'color', type: 'String' },
];

const componentName = ref('');
const inheritAttrs = ref(true);
const props = ref([]);
const emits = ref([]);

const defaultHint = (type) => {
  if (type === 'Array') return '默认值,如 []';
  if (type === 'Object') return '默认值,如 {}';
  if (type === 'Function') return '无默认值';
  return '默认值';
};

const activeGraph = computed(() => panelProps.graph || window._graph || null);

// 从 graph.extra 初始化。graph 通过父面板传入，避免依赖非响应式的 window._graph。
watch(activeGraph, (graph) => {
  if (!graph) return;
  const extra = graph.extra || {};
  componentName.value = extra.componentName || '';
  inheritAttrs.value = extra.inheritAttrs !== false; // 默认 true
  props.value = Array.isArray(extra.componentProps)
    ? extra.componentProps.map((p) => ({
        name: p.name || '',
        type: p.type || 'String',
        default: p.default ?? '',
        required: !!p.required,
      }))
    : [];
  emits.value = Array.isArray(extra.componentEmits)
    ? extra.componentEmits.map((e) => ({ name: typeof e === 'string' ? e : (e?.name || '') }))
    : [];
}, { immediate: true });

const addProp = () => {
  props.value.push({ name: '', type: 'String', default: '', required: false });
};
const addCommonProp = (cp) => {
  if (props.value.some((p) => p.name === cp.name)) return;
  props.value.push({ name: cp.name, type: cp.type, default: cp.default ?? '', required: false });
  commit();
};
const removeProp = (i) => {
  props.value.splice(i, 1);
  commit();
};
const addEmit = () => {
  emits.value.push({ name: '' });
};
const removeEmit = (i) => {
  emits.value.splice(i, 1);
  commit();
};

// 写回 graph.extra 并触发重新生成 + 持久化(runStep 内部 serialize → nodeEditorData)
const commit = () => {
  const graph = activeGraph.value;
  if (!graph) return;
  graph.extra = graph.extra || {};
  graph.extra.componentName = componentName.value.trim();
  graph.extra.inheritAttrs = inheritAttrs.value;
  graph.extra.componentProps = props.value.map((p) => ({
    name: p.name,
    type: p.type,
    default: p.default,
    required: p.required,
  }));
  graph.extra.componentEmits = emits.value
    .map((e) => e.name)
    .filter(Boolean)
    .map((name) => ({ name }));
  runStep();
};
</script>
