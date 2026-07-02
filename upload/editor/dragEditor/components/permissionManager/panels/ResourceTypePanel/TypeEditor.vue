<template>
  <div class="column no-wrap fit">
    <!-- 工具栏 (非 inline 模式时显示) -->
    <q-bar v-if="!inline" dense dark class="bg-grey-9 text-grey-7">
      <div class="text-caption">{{ isNew ? '新建资源类型' : '资源类型详情' }}</div>
      <q-space />
      <q-btn
        flat
        dense
        icon="save"
        size="sm"
        :disable="!canSave"
        @click="handleSave"
      >
        <q-tooltip>保存</q-tooltip>
      </q-btn>
      <q-btn
        v-if="!isNew"
        flat
        dense
        icon="close"
        size="sm"
        @click="handleCancel"
      >
        <q-tooltip>取消</q-tooltip>
      </q-btn>
    </q-bar>

    <!-- 详情表单 -->
    <q-scroll-area v-if="!inline" class="col bg-grey-10">
      <div v-if="currentType" class="q-pa-md">
        <q-form class="q-gutter-md">
          <!-- 基础信息 -->
          <div class="text-subtitle2 text-grey-7 q-mb-sm">基础信息</div>

          <q-input
            v-model="form.name"
            label="类型名称"
            dense
            dark
            outlined
            :rules="[val => !!val || '请输入类型名称']"
            hint="如：数据表格、报表、工作流"
          />

          <q-input
            v-model="form.code"
            label="类型编码"
            dense
            dark
            outlined
            :rules="[val => !!val || '请输入类型编码', val => /^[a-z_]+$/.test(val) || '只能使用小写字母和下划线']"
            hint="唯一标识，如：datagrid、report、workflow"
          />

          <q-input
            v-model="form.prefix"
            label="资源标识前缀"
            dense
            dark
            outlined
            hint="如：table:、report:、workflow:"
          />

          <q-input
            v-model="form.description"
            label="描述"
            type="textarea"
            dense
            dark
            outlined
            rows="2"
          />

          <!-- 操作配置 -->
          <div class="text-subtitle2 text-grey-7 q-mt-md q-mb-sm">可用操作配置</div>

          <div class="q-gutter-sm">
            <div v-for="(action, index) in form.actions" :key="index" class="row items-center q-gutter-sm">
              <q-input
                v-model="action.name"
                label="操作名称"
                dense
                dark
                outlined
                style="width: 120px"
                hint="如：查看"
              />
              <q-input
                v-model="action.code"
                label="操作编码"
                dense
                dark
                outlined
                style="width: 120px"
                hint="如：read"
              />
              <q-select
                v-model="action.uiEffect"
                :options="uiEffectOptions"
                label="UI效果"
                dense
                dark
                outlined
                emit-value
                map-options
                style="width: 120px"
              />
              <q-toggle
                v-model="action.needBackendCheck"
                label="后端校验"
                dense
                dark
              />
              <q-btn
                flat
                dense
                round
                icon="delete"
                size="sm"
                color="negative"
                @click="handleRemoveAction(index)"
              />
            </div>

            <q-btn
              flat
              dense
              icon="add"
              label="添加操作"
              size="sm"
              class="text-grey-7"
              @click="handleAddAction"
            />
          </div>

          <!-- 元信息 -->
          <div v-if="!isNew" class="text-caption text-grey-7 q-mt-md">
            <div>类型ID: {{ currentType.id }}</div>
            <div v-if="currentType.createdAt">
              创建时间: {{ new Date(currentType.createdAt).toLocaleString() }}
            </div>
            <div v-if="currentType.isSystem" class="text-warning">
              系统预置类型，不可删除
            </div>
          </div>
        </q-form>
      </div>

      <div v-else class="q-pa-md text-center text-grey-7">
        <q-icon name="category" class="q-mb-md" />
        <div class="text-subtitle2 q-mb-sm">开始创建资源类型</div>
        <div class="text-caption">
          点击左上角的"添加资源类型"按钮创建第一个资源类型
        </div>
      </div>
    </q-scroll-area>

    <!-- inline 模式：直接显示表单 -->
    <div v-else>
      <div v-if="currentType">
        <q-form class="q-gutter-md">
          <!-- 基础信息 -->
          <div class="text-subtitle2 text-grey-7 q-mb-sm">基础信息</div>

          <q-input
            v-model="form.name"
            label="类型名称"
            dense
            dark
            outlined
            :rules="[val => !!val || '请输入类型名称']"
            hint="如：数据表格、报表、工作流"
          />

          <q-input
            v-model="form.code"
            label="类型编码"
            dense
            dark
            outlined
            :rules="[val => !!val || '请输入类型编码', val => /^[a-z_]+$/.test(val) || '只能使用小写字母和下划线']"
            hint="唯一标识，如：datagrid、report、workflow"
          />

          <q-input
            v-model="form.prefix"
            label="资源标识前缀"
            dense
            dark
            outlined
            hint="如：table:、report:、workflow:"
          />

          <q-input
            v-model="form.description"
            label="描述"
            type="textarea"
            dense
            dark
            outlined
            rows="2"
          />

          <!-- 操作配置 -->
          <div class="text-subtitle2 text-grey-7 q-mt-md q-mb-sm">可用操作配置</div>

          <div class="q-gutter-sm">
            <div v-for="(action, index) in form.actions" :key="index" class="row items-center q-gutter-sm">
              <q-input
                v-model="action.name"
                label="操作名称"
                dense
                dark
                outlined
                style="width: 120px"
                hint="如：查看"
              />
              <q-input
                v-model="action.code"
                label="操作编码"
                dense
                dark
                outlined
                style="width: 120px"
                hint="如：read"
              />
              <q-select
                v-model="action.uiEffect"
                :options="uiEffectOptions"
                label="UI效果"
                dense
                dark
                outlined
                emit-value
                map-options
                style="width: 120px"
              />
              <q-toggle
                v-model="action.needBackendCheck"
                label="后端校验"
                dense
                dark
              />
              <q-btn
                flat
                dense
                round
                icon="delete"
                size="sm"
                color="negative"
                @click="handleRemoveAction(index)"
              />
            </div>

            <q-btn
              flat
              dense
              icon="add"
              label="添加操作"
              size="sm"
              class="text-grey-7"
              @click="handleAddAction"
            />
          </div>

          <!-- 元信息 -->
          <div v-if="!isNew" class="text-caption text-grey-7 q-mt-md">
            <div>类型ID: {{ currentType.id }}</div>
            <div v-if="currentType.createdAt">
              创建时间: {{ new Date(currentType.createdAt).toLocaleString() }}
            </div>
            <div v-if="currentType.isSystem" class="text-warning">
              系统预置类型，不可删除
            </div>
          </div>
        </q-form>
      </div>

      <div v-else class="q-pa-md text-center text-grey-7">
        <q-icon name="category" class="q-mb-md" />
        <div class="text-subtitle2 q-mb-sm">开始创建资源类型</div>
        <div class="text-caption">
          点击"添加资源类型"按钮创建第一个资源类型
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  currentType: {
    type: Object,
    default: null
  },
  isNew: {
    type: Boolean,
    default: false
  },
  inline: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['save', 'cancel']);

// 表单数据
const form = ref({
  name: '',
  code: '',
  prefix: '',
  description: '',
  actions: []
});

// UI效果选项
const uiEffectOptions = [
  { label: '无', value: 'none' },
  { label: '隐藏', value: 'hidden' },
  { label: '禁用', value: 'disabled' },
  { label: '只读', value: 'readonly' },
  { label: '脱敏', value: 'masked' }
];

// 是否可以保存
const canSave = computed(() => {
  return !!form.value.name && !!form.value.code && /^[a-z_]+$/.test(form.value.code);
});

/**
 * 监听当前类型变化
 */
watch(() => props.currentType, (type) => {
  if (type && type.id === 'new') {
    // 新建模式：清空表单
    form.value = {
      name: '',
      code: '',
      prefix: '',
      description: '',
      actions: [
        { name: '查看', code: 'read', uiEffect: 'none', needBackendCheck: true },
        { name: '编辑', code: 'write', uiEffect: 'none', needBackendCheck: true }
      ]
    };
  } else if (type) {
    // 编辑模式：加载数据
    form.value = {
      name: type.name || '',
      code: type.code || '',
      prefix: type.prefix || '',
      description: type.description || '',
      actions: type.actions ? JSON.parse(JSON.stringify(type.actions)) : []
    };
  }
}, { immediate: true });

/**
 * 保存
 */
function handleSave() {
  if (!canSave.value) return;
  emit('save', { ...form.value });
}

/**
 * 取消
 */
function handleCancel() {
  emit('cancel');
}

/**
 * 添加操作
 */
function handleAddAction() {
  form.value.actions.push({
    name: '',
    code: '',
    uiEffect: 'none',
    needBackendCheck: false
  });
}

/**
 * 移除操作
 */
function handleRemoveAction(index) {
  form.value.actions.splice(index, 1);
}

// 暴露方法供父组件调用
defineExpose({
  handleSave
});
</script>
