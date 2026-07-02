<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm">
      <template v-for="group in formList" :key="group.key">
        <q-expansion-item
          v-if="group.items?.length"
          dense
          dark
          :label="group.label"
          :icon="group.icon"
          :default-opened="group.expanded !== false"
          header-class="text-grey-5"
        >
          <div class="q-pa-xs">
            <template v-for="item in group.items" :key="item.prop">
              <!-- 分隔线 -->
              <q-separator v-if="item.type === 'separator'" dark class="q-my-sm" />

              <!-- 输入框 -->
              <div v-else-if="item.type === 'input'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-input
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  outlined
                  :placeholder="item.placeholder"
                  class="form-control"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 数字输入 -->
              <div v-else-if="item.type === 'number'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-input
                  v-model.number="bindProp[item.prop]"
                  dark
                  dense
                  outlined
                  type="number"
                  :min="item.min"
                  :max="item.max"
                  :step="item.step || 1"
                  class="form-control"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 下拉选择 -->
              <div v-else-if="item.type === 'select'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-select
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  outlined
                  :options="item.options"
                  emit-value
                  map-options
                  class="form-control"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 颜色选择 -->
              <div v-else-if="item.type === 'color'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <div class="row items-center no-wrap form-control">
                  <q-input
                    v-model="bindProp[item.prop]"
                    dark
                    dense
                    outlined
                    class="col"
                    @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                  >
                    <template #prepend>
                      <q-icon name="colorize" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-color
                            v-model="bindProp[item.prop]"
                            dark
                            format-model="hex"
                            @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                          />
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
              </div>

              <!-- 开关 -->
              <div v-else-if="item.type === 'switch'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-toggle
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  class="form-control"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 滑块 -->
              <div v-else-if="item.type === 'slider'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-slider
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  :min="item.min ?? 0"
                  :max="item.max ?? 100"
                  :step="item.step ?? 1"
                  class="form-control"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 文件上传 -->
              <div v-else-if="item.type === 'file'" class="form-row">
                <span class="form-label">{{ item.label }}</span>
                <q-file
                  v-model="tempFiles[item.prop]"
                  dark
                  dense
                  outlined
                  :accept="item.accept"
                  class="form-control"
                  @update:model-value="(f) => handleFileChange(item.prop, f, item.event)"
                >
                  <template #prepend>
                    <q-icon name="attach_file" />
                  </template>
                </q-file>
              </div>

              <!-- 按钮 -->
              <div v-else-if="item.type === 'button'" class="form-row">
                <q-btn
                  dark
                  dense
                  flat
                  :label="item.label"
                  :icon="item.icon"
                  :color="item.color || 'primary'"
                  class="full-width"
                  @click="handleClick(item.action)"
                />
              </div>

              <!-- 文本域 -->
              <div v-else-if="item.type === 'textarea'" class="form-row form-row-full">
                <span class="form-label">{{ item.label }}</span>
                <q-input
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  outlined
                  type="textarea"
                  :rows="item.rows || 3"
                  class="full-width q-mt-xs"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>

              <!-- 按钮组 -->
              <div v-else-if="item.type === 'button-group'" class="form-row form-row-full">
                <span class="form-label">{{ item.label }}</span>
                <q-btn-toggle
                  v-model="bindProp[item.prop]"
                  dark
                  dense
                  flat
                  spread
                  :options="item.options"
                  class="full-width q-mt-xs"
                  @update:model-value="(v) => handleChange(item.prop, v, item.event)"
                />
              </div>
            </template>
          </div>
        </q-expansion-item>
      </template>
    </div>
  </q-scroll-area>
</template>

<script setup>
import { ref, reactive, watch } from "vue";

const props = defineProps({
  /** 表单分组定义 */
  formList: {
    type: Array,
    default: () => [],
  },
  /** 绑定的数据对象 */
  modelValue: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:modelValue", "change", "action"]);

// 绑定的属性对象
const bindProp = reactive({});

// 临时文件存储
const tempFiles = ref({});

// 同步 modelValue 到 bindProp
watch(
  () => props.modelValue,
  (val) => {
    Object.keys(val).forEach((key) => {
      bindProp[key] = val[key];
    });
  },
  { immediate: true, deep: true }
);

// 处理属性变化
function handleChange(prop, value, event) {
  bindProp[prop] = value;
  emit("update:modelValue", { ...bindProp });
  emit("change", { prop, value, event: event || "change" });
}

// 处理文件变化
function handleFileChange(prop, file, event) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    handleChange(prop, result, event);
  };
  reader.readAsDataURL(file);
}

// 处理按钮点击
function handleClick(action) {
  emit("action", action);
}

defineExpose({
  bindProp,
});
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.form-row-full {
  flex-direction: column;
  align-items: flex-start;
}

.form-label {
  width: 70px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}

.form-control {
  flex: 1;
  min-width: 0;
}
</style>
