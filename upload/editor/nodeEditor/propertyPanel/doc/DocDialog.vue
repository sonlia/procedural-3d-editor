<template>
  <q-dialog v-model="show" persistent>
    <q-card dark class="doc-dialog-card">
      <q-bar dark dense class="bg-grey-9">
        <q-icon name="help_outline" />
        <div class="q-ml-sm">{{ title }}</div>
        <q-space />
        <q-btn v-if="docsUrl" dense flat icon="open_in_new" @click="openInNewTab">
          <q-tooltip>在新标签页打开</q-tooltip>
        </q-btn>
        <q-btn dense flat icon="close" v-close-popup>
          <q-tooltip>关闭</q-tooltip>
        </q-btn>
      </q-bar>

      <q-card-section class="q-pa-none doc-dialog-content">
        <component
          :is="resolvedViewer"
          v-if="resolvedViewer"
          :docs="normalizedDocs"
          :component-name="componentName"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  docs: {
    type: Object,
    default: () => ({})
  },
  componentName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

const show = ref(props.modelValue);

const docViewers = import.meta.glob('./viewers/*.vue');
const builtinViewers = {
  api: defineAsyncComponent(() => import('./NodeApiViewer.vue')),
  text: defineAsyncComponent(() => import('./TextDocViewer.vue')),
  url: defineAsyncComponent(() => import('./UrlDocViewer.vue')),
};

const normalizedDocs = computed(() => props.docs || {});
const docsUrl = computed(() => normalizedDocs.value.url || '');
const title = computed(() => normalizedDocs.value.title || '帮助');
const viewerType = computed(() => normalizedDocs.value.component || (docsUrl.value ? 'url' : 'text'));

const resolvedViewer = computed(() => {
  if (viewerType.value === 'url' && !docsUrl.value) {
    return builtinViewers.text;
  }

  if (builtinViewers[viewerType.value]) {
    return builtinViewers[viewerType.value];
  }

  const loader = docViewers[`./viewers/${viewerType.value}.vue`];
  if (loader) {
    return defineAsyncComponent(loader);
  }

  return docsUrl.value ? builtinViewers.url : builtinViewers.text;
});

watch(() => props.modelValue, (val) => {
  show.value = val;
});

watch(show, (val) => {
  emit('update:modelValue', val);
});

function openInNewTab() {
  if (!docsUrl.value) return;
  window.open(docsUrl.value, '_blank');
}
</script>

<style scoped>
.doc-dialog-card {
  width: 75vw;
  max-width: 75vw;
  height: 75vh;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
}

.doc-dialog-content {
  flex: 1;
  overflow-y: auto;
  background-color: #1d1d1d;
  min-height: 0;
}

/* 滚动条样式 */
.doc-dialog-content::-webkit-scrollbar {
  width: 8px;
}

.doc-dialog-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
}

.doc-dialog-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.doc-dialog-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
