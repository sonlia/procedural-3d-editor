<template>
  <q-card flat bordered class="redis-config-panel overflow-auto" dark>
    <q-card-section>
      <div class="text-h6">Redis 连接配置</div>
    </q-card-section>

    <q-card-section class="q-pa-md">
      <q-form>
        <!-- 连接设置 -->
        <div class="section-header q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold">连接设置</div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-8">
            <q-input
              v-model="config.host"
              label="主机地址"
              outlined
              dense
              dark
              @update:model-value="updateConfig('host', $event)"
            />
          </div>
          <div class="col-12 col-md-4">
            <q-input
              v-model.number="config.port"
              label="端口"
              type="number"
              outlined
              dense
              dark
              @update:model-value="updateConfig('port', $event)"
            />
          </div>
        </div>

        <div class="row q-col-gutter-md q-mt-xs">
          <div class="col-12 col-md-6">
            <q-input
              v-model="config.username"
              label="用户名（可选，Redis 6.0+ ACL）"
              outlined
              dense
              dark
              @update:model-value="updateConfig('username', $event)"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-input
              v-model="config.password"
              label="密码（可选）"
              type="password"
              outlined
              dense
              dark
              @update:model-value="updateConfig('password', $event)"
            />
          </div>
        </div>

        <!-- 服务器信息 -->
        <div v-if="serverInfo" class="section-header q-pt-lg q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold">服务器信息</div>
        </div>

        <div v-if="serverInfo" class="server-info q-pa-md">
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <div class="text-caption text-grey-6">版本</div>
              <div>{{ serverInfo.redis_version }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-6">已用内存</div>
              <div>{{ serverInfo.used_memory_human }}</div>
            </div>
            <div class="col-6 q-mt-sm">
              <div class="text-caption text-grey-6">Key 数量</div>
              <div>{{ serverInfo.dbSize }}</div>
            </div>
            <div class="col-6 q-mt-sm">
              <div class="text-caption text-grey-6">已连接客户端</div>
              <div>{{ serverInfo.connected_clients }}</div>
            </div>
          </div>
        </div>
      </q-form>
    </q-card-section>

    <q-card-section>
      <q-btn
        label="测试连接"
        color="primary"
        :loading="testing"
        @click="testConnection"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import { currentSelectTreeNode } from "./hooks/useDbConfig";
import { dbTreeManager } from "./hooks/useDbTreeManager";
import { useProjectStore } from "../../../stores/projectMange.js";
import api from "../../../services/api.js";

const $q = useQuasar();
const manager = dbTreeManager();
const _project = useProjectStore();

const testing = ref(false);
const serverInfo = ref(null);

// Redis 配置
const config = ref({
  host: "localhost",
  port: 6379,
  password: "",
  username: "",
});

// 从节点数据加载配置
const loadConfigFromNode = () => {
  const node = currentSelectTreeNode.value;
  if (!node || node.type !== "redis") return;

  const graphData = _project.getDbEditorData(node.id, 'graphData');
  const extra = graphData?.extra || {};
  config.value = {
    host: extra.host || "localhost",
    port: extra.port || 6379,
    password: extra.password || "",
    username: extra.username || "",
  };
};

// 更新配置到节点
const updateConfig = (key, value) => {
  const node = currentSelectTreeNode.value;
  if (!node || node.type !== "redis") return;

  const graphData = _project.getDbEditorData(node.id, 'graphData') || {};
  const extra = graphData.extra || {};
  extra[key] = value;
  _project.updateDbEditorData(node.id, 'graphData', { ...graphData, extra });

  // 防抖保存配置
  debouncedSaveConfig();
};

// 防抖保存配置（500ms 后保存）
const debouncedSaveConfig = useDebounceFn(() => {
  manager.saveTreeData();
}, 500);

// 测试连接
const testConnection = async () => {
  testing.value = true;
  serverInfo.value = null;

  try {
    const response = await api.post("/api/redis/test", config.value);

    if (response.data.success) {
      $q.notify({
        type: "positive",
        message: response.data.message,
      });

      // 测试成功后保存配置
      await manager.saveTreeData();

      // 获取服务器信息
      const infoResponse = await api.post("/api/redis/info", {
        config: config.value,
      });

      if (infoResponse.data.success) {
        const info = infoResponse.data.data.info;
        serverInfo.value = {
          redis_version: info.Server?.redis_version || "未知",
          used_memory_human: info.Memory?.used_memory_human || "未知",
          connected_clients: info.Clients?.connected_clients || "0",
          dbSize: infoResponse.data.data.dbSize || 0,
        };
      }
    } else {
      $q.notify({
        type: "negative",
        message: response.data.message,
      });
    }
  } catch (error) {
    console.error("测试连接失败:", error);
    $q.notify({
      type: "negative",
      message: `测试连接失败: ${error.message}`,
    });
  } finally {
    testing.value = false;
  }
};

// 监听节点变化
watch(currentSelectTreeNode, (node) => {
  if (node && node.type === "redis") {
    loadConfigFromNode();
    serverInfo.value = null;
  }
}, { immediate: true });

onMounted(() => {
  loadConfigFromNode();
});
</script>

<style scoped>
.redis-config-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.redis-config-panel .q-card-section:first-child {
  padding-bottom: 0;
}

.section-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.server-info {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
</style>
