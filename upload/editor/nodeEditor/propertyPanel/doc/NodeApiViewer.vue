<template>
  <div class="node-api-viewer">
    <div v-if="loading" class="loading-container">
      <q-spinner-dots size="3em" color="primary" />
      <div class="text-caption q-mt-md">加载中...</div>
    </div>

    <div v-else-if="error" class="error-container">
      <q-icon name="error_outline" size="3em" color="negative" />
      <div class="text-caption q-mt-md">{{ error }}</div>
    </div>

    <div v-else class="api-content">
      <!-- Tabs -->
      <q-tabs
        v-model="activeTab"
        dense
        active-color="primary"
        indicator-color="primary"
        align="left"
        dark
      >
        <q-tab v-if="hasProps" name="props" label="Props" />
        <q-tab v-if="hasEvents" name="events" label="Events" />
        <q-tab v-if="hasSlots" name="slots" label="Slots" />
        <q-tab v-if="hasMethods" name="methods" label="Methods" />
      </q-tabs>

      <q-separator dark />

      <!-- Tab Panels -->
      <q-tab-panels v-model="activeTab" animated dark class="api-panels">
        <!-- Props with Categories -->
        <q-tab-panel v-if="hasProps" name="props" class="q-pa-none">
          <div class="props-layout">
            <!-- Left: Category Navigation -->
            <div v-if="propCategories.length > 1" class="category-sidebar">
              <q-list dark dense>
                <q-item
                  v-for="category in propCategories"
                  :key="category"
                  clickable
                  v-ripple
                  :active="activeCategory === category"
                  @click="activeCategory = category"
                  active-class="category-active"
                >
                  <q-item-section>
                    <q-item-label>{{ category }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge color="grey-7" :label="categoryCounts[category]" />
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <!-- Separator -->
            <q-separator v-if="propCategories.length > 1" vertical dark />

            <!-- Right: Props Content -->
            <div class="props-content">
              <div class="q-pa-md">
                <div v-for="(prop, propName) in filteredProps" :key="propName" class="api-item">
                  <div class="api-item-name">
                    <q-badge color="orange-8">{{ propName }}</q-badge>
                    <span v-if="prop.required" class="text-negative q-ml-sm">required</span>
                  </div>
                  <div class="api-item-type">
                    <strong>Type:</strong> {{ formatType(prop.type) }}
                  </div>
                  <div v-if="prop.default !== undefined" class="api-item-default">
                    <strong>Default:</strong> <code>{{ prop.default }}</code>
                  </div>
                  <div v-if="prop.desc_cn || prop.desc" class="api-item-desc">
                    {{ prop.desc_cn || prop.desc }}
                  </div>
                  <div v-if="prop.examples && prop.examples.length" class="api-item-examples">
                    <strong>Examples:</strong>
                    <div v-for="(example, idx) in prop.examples" :key="idx" class="example-item">
                      <code>{{ example }}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Events -->
        <q-tab-panel v-if="hasEvents" name="events" class="q-pa-md">
          <div v-for="(event, eventName) in nodeData.events" :key="eventName" class="api-item">
            <div class="api-item-name">
              <q-badge color="green-5">@{{ eventName }}</q-badge>
            </div>
            <div v-if="event.desc_cn || event.desc" class="api-item-desc">
              {{ event.desc_cn || event.desc }}
            </div>
            <div v-if="event.params" class="api-item-params">
              <strong>Parameters:</strong>
              <div v-for="(param, paramName) in event.params" :key="paramName" class="param-item q-ml-md">
                <code>{{ paramName }}</code>: {{ param.desc_cn || param.desc }}
              </div>
            </div>
          </div>
        </q-tab-panel>

        <!-- Slots -->
        <q-tab-panel v-if="hasSlots" name="slots" class="q-pa-md">
          <div v-for="(slot, slotName) in nodeData.slots" :key="slotName" class="api-item">
            <div class="api-item-name">
              <q-badge color="purple-5">{{ slotName }}</q-badge>
            </div>
            <div v-if="slot.desc_cn || slot.desc" class="api-item-desc">
              {{ slot.desc_cn || slot.desc }}
            </div>
          </div>
        </q-tab-panel>

        <!-- Methods -->
        <q-tab-panel v-if="hasMethods" name="methods" class="q-pa-md">
          <div v-for="(method, methodName) in nodeData.methods" :key="methodName" class="api-item">
            <div class="api-item-name">
              <q-badge color="blue-5">{{ methodName }}()</q-badge>
            </div>
            <div v-if="method.desc_cn || method.desc" class="api-item-desc">
              {{ method.desc_cn || method.desc }}
            </div>
            <div v-if="method.params" class="api-item-params">
              <strong>Parameters:</strong>
              <div v-for="(param, paramName) in method.params" :key="paramName" class="param-item q-ml-md">
                <code>{{ paramName }}</code>: {{ param.desc_cn || param.desc }}
              </div>
            </div>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  componentName: {
    type: String,
    required: true
  }
});

const loading = ref(true);
const error = ref('');
const nodeData = ref({});
const activeTab = ref('props');
const activeCategory = ref('');

const hasProps = computed(() => nodeData.value.props && Object.keys(nodeData.value.props).length > 0);
const hasEvents = computed(() => nodeData.value.events && Object.keys(nodeData.value.events).length > 0);
const hasSlots = computed(() => nodeData.value.slots && Object.keys(nodeData.value.slots).length > 0);
const hasMethods = computed(() => nodeData.value.methods && Object.keys(nodeData.value.methods).length > 0);

// 提取所有 Props 的 category
const propCategories = computed(() => {
  if (!nodeData.value.props) return [];

  const categories = new Set();
  Object.values(nodeData.value.props).forEach(prop => {
    if (prop.category) {
      // 支持 category 中的多个分类，用 | 分隔
      prop.category.split('|').forEach(cat => {
        categories.add(cat.trim());
      });
    }
  });

  return Array.from(categories).sort();
});

// 计算每个分类的属性数量
const categoryCounts = computed(() => {
  const counts = {};

  propCategories.value.forEach(category => {
    counts[category] = 0;
  });

  if (nodeData.value.props) {
    Object.values(nodeData.value.props).forEach(prop => {
      if (prop.category) {
        prop.category.split('|').forEach(cat => {
          const category = cat.trim();
          if (counts[category] !== undefined) {
            counts[category]++;
          }
        });
      }
    });
  }

  return counts;
});

// 根据选中的 category 过滤 props
const filteredProps = computed(() => {
  if (!nodeData.value.props) return {};
  if (!activeCategory.value || propCategories.value.length <= 1) {
    return nodeData.value.props;
  }

  const filtered = {};
  Object.entries(nodeData.value.props).forEach(([propName, prop]) => {
    if (prop.category && prop.category.includes(activeCategory.value)) {
      filtered[propName] = prop;
    }
  });

  return filtered;
});

function formatType(type) {
  if (Array.isArray(type)) {
    return type.join(' | ');
  }
  return type || 'Any';
}

onMounted(async () => {
  try {
    const url = `/src/components/editor/nodeEditor/node/uiNode/quasar/${props.componentName}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status}`);
    }
    const data = await response.json();
    nodeData.value = data;

    // 设置默认激活的 tab
    if (hasProps.value) {
      activeTab.value = 'props';
      // 设置默认激活的 category
      if (propCategories.value.length > 0) {
        activeCategory.value = propCategories.value[0];
      }
    } else if (hasEvents.value) {
      activeTab.value = 'events';
    } else if (hasSlots.value) {
      activeTab.value = 'slots';
    } else if (hasMethods.value) {
      activeTab.value = 'methods';
    }

    loading.value = false;
  } catch (err) {
    console.error('Failed to load node API:', err);
    error.value = err.message;
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
.node-api-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1d1d1d;
  color: rgba(255, 255, 255, 0.87);
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.6);
}

.api-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.api-panels {
  background-color: #1d1d1d;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.props-layout {
  display: flex;
  height: 100%;
  min-height: 300px;
}

.category-sidebar {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  background-color: #252525;
}

.category-active {
  background-color: rgba(33, 150, 243, 0.2) !important;
  color: #2196f3 !important;
}

.props-content {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}

/* 滚动条样式 - category sidebar */
.category-sidebar::-webkit-scrollbar {
  width: 6px;
}

.category-sidebar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.category-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.category-sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 滚动条样式 - props content */
.props-content::-webkit-scrollbar {
  width: 8px;
}

.props-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.props-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.props-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.api-item {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  &:last-child {
    border-bottom: none;
  }
}

.api-item-name {
  margin-bottom: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.api-item-type,
.api-item-default {
  margin-bottom: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);

  strong {
    color: rgba(255, 255, 255, 0.9);
  }

  code {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }
}

.api-item-desc {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.api-item-examples {
  margin-top: 8px;
  font-size: 13px;

  strong {
    color: rgba(255, 255, 255, 0.9);
  }
}

.example-item {
  margin-left: 16px;
  margin-top: 4px;

  code {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #4fc3f7;
  }
}

.api-item-params {
  margin-top: 8px;
  font-size: 13px;

  strong {
    color: rgba(255, 255, 255, 0.9);
  }
}

.param-item {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.7);

  code {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #ffb74d;
  }
}

/* 滚动条样式 */
.api-panels::-webkit-scrollbar {
  width: 8px;
}

.api-panels::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.api-panels::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.api-panels::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
