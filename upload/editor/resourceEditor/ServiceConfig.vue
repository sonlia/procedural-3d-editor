<template>
  <div class="column full-height q-pa-sm">
    <!-- 配置状态提示 -->
    <q-banner v-if="!hasValidConfig" class="bg-orange-9 text-white q-mb-sm" dense rounded>
      <template #avatar>
        <q-icon name="warning" />
      </template>
      请配置文件服务连接信息
    </q-banner>

    <q-banner v-else class="bg-positive text-white q-mb-sm" dense rounded>
      <template #avatar>
        <q-icon name="check_circle" />
      </template>
      服务已配置
    </q-banner>

    <!-- 配置表单 -->
    <q-scroll-area class="col">
      <q-form @submit="handleSave" class="q-gutter-sm">
        <!-- 服务类型 -->
        <q-select
          v-model="formData.type"
          :options="serviceTypeOptions"
          label="服务类型"
          emit-value
          map-options
          dark
          dense
          outlined
        />

        <!-- 端点 URL -->
        <q-input
          v-model="formData.endpoint"
          label="Endpoint URL"
          placeholder="https://oss-cn-hangzhou.aliyuncs.com"
          dark
          dense
          outlined
          :rules="[val => !!val || '请输入 Endpoint']"
        />

        <!-- Bucket -->
        <q-input
          v-model="formData.bucket"
          label="Bucket"
          placeholder="my-bucket"
          dark
          dense
          outlined
          :rules="[val => !!val || '请输入 Bucket']"
        />

        <!-- Access Key ID -->
        <q-input
          v-model="formData.accessKeyId"
          label="Access Key ID"
          dark
          dense
          outlined
          :rules="[val => !!val || '请输入 Access Key ID']"
        />

        <!-- Access Key Secret -->
        <q-input
          v-model="formData.accessKeySecret"
          label="Access Key Secret"
          :type="showSecret ? 'text' : 'password'"
          dark
          dense
          outlined
          :rules="[val => !!val || '请输入 Access Key Secret']"
        >
          <template #append>
            <q-icon
              :name="showSecret ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showSecret = !showSecret"
            />
          </template>
        </q-input>

        <!-- Region (可选) -->
        <q-input
          v-model="formData.region"
          label="Region (可选)"
          placeholder="oss-cn-hangzhou"
          dark
          dense
          outlined
        />

        <!-- 路径前缀 (可选) -->
        <q-input
          v-model="formData.prefix"
          label="路径前缀 (可选)"
          placeholder="/assets/"
          dark
          dense
          outlined
        />

        <!-- 自定义域名 (可选) -->
        <q-input
          v-model="formData.customDomain"
          label="自定义域名 (可选)"
          placeholder="https://cdn.example.com"
          dark
          dense
          outlined
        />
      </q-form>
    </q-scroll-area>

    <!-- 操作按钮 -->
    <div class="row q-gutter-sm q-mt-sm">
      <q-btn
        outline
        dense
        label="测试连接"
        icon="wifi_tethering"
        :loading="isTesting"
        @click="handleTestConnection"
        class="col"
      />
      <q-btn
        color="primary"
        dense
        label="保存配置"
        icon="save"
        :loading="isSaving"
        @click="handleSave"
        class="col"
      />
    </div>

    <!-- 浏览按钮 -->
    <q-btn
      v-if="hasValidConfig"
      flat
      dense
      label="浏览远程文件"
      icon="folder_open"
      class="full-width q-mt-sm"
      @click="emit('browse')"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, defineProps,  onMounted } from "vue";
import { Notify } from "quasar";
import {
  SERVICE_TYPES,
  updateServiceConfig,
  getServiceConfig,
} from "src/components/leftWidget/resources/useResourceTree.js";

const props = defineProps({
  node: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["browse"]);

// 服务类型选项
const serviceTypeOptions = Object.values(SERVICE_TYPES);

// 表单数据
const formData = ref({
  type: "oss",
  endpoint: "",
  bucket: "",
  accessKeyId: "",
  accessKeySecret: "",
  region: "",
  prefix: "",
  customDomain: "",
});

// 状态
const showSecret = ref(false);
const isTesting = ref(false);
const isSaving = ref(false);

// 是否有有效配置
const hasValidConfig = computed(() => {
  return !!(
    formData.value.endpoint &&
    formData.value.bucket &&
    formData.value.accessKeyId &&
    formData.value.accessKeySecret
  );
});

// 加载配置
const loadConfig = () => {
  if (!props.node?.id) return;

  const config = getServiceConfig(props.node.id);
  if (config) {
    formData.value = {
      type: config.type || "oss",
      endpoint: config.endpoint || "",
      bucket: config.bucket || "",
      accessKeyId: config.accessKeyId || "",
      accessKeySecret: config.accessKeySecret || "",
      region: config.region || "",
      prefix: config.prefix || "",
      customDomain: config.customDomain || "",
    };
  }
};

// 监听节点变化
watch(
  () => props.node?.id,
  () => {
    loadConfig();
  },
  { immediate: true }
);

onMounted(() => {
  loadConfig();
});

// 测试连接
const handleTestConnection = async () => {
  if (!hasValidConfig.value) {
    Notify.create({
      type: "warning",
      message: "请先填写完整的配置信息",
    });
    return;
  }

  isTesting.value = true;

  try {
    // 发送测试请求到后端
    const response = await fetch("/api/resources/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData.value),
    });

    const result = await response.json();

    if (result.success) {
      Notify.create({
        type: "positive",
        message: "连接成功",
        caption: `找到 ${result.fileCount || 0} 个文件`,
      });
    } else {
      Notify.create({
        type: "negative",
        message: "连接失败",
        caption: result.error || "请检查配置信息",
      });
    }
  } catch (error) {
    Notify.create({
      type: "negative",
      message: "连接测试失败",
      caption: error.message,
    });
  } finally {
    isTesting.value = false;
  }
};

// 保存配置
const handleSave = async () => {
  if (!props.node?.id) return;

  if (!hasValidConfig.value) {
    Notify.create({
      type: "warning",
      message: "请填写必填配置项",
    });
    return;
  }

  isSaving.value = true;

  try {
    updateServiceConfig(props.node.id, { ...formData.value });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: "保存失败",
      caption: error.message,
    });
  } finally {
    isSaving.value = false;
  }
};
</script>
