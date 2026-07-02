<script setup>
import { useDbDatabasePanel } from "./hooks/useDbDatabasePanel";
import { computed, onMounted, watch } from "vue";
import { useDbConfig } from "./hooks/useDbConfig";
import {
  useDbExtensions,
  PLUGINS,
  extensionStatus,
  enabling,
  extError,
} from "./hooks/useDbExtensions";

const { getConfig, updateConfig } = useDbConfig();
const {
  charsetOptions,
  handleTestConnection,
  updateTemp,
  updateFinalValue,
} = useDbDatabasePanel();

// 修改计算属性的实现
const createConfigProp = (path) => {
  return computed({
    get: () => {
      return getConfig(path);
    },
    set: (value) => {
      updateConfig(path, value);
    },
  });
};

// 定义需要的双向绑定计算属性
const host = createConfigProp("connection.host");
const port = createConfigProp("connection.port");
const user = createConfigProp("connection.user");
const password = createConfigProp("connection.password");
const database = createConfigProp("connection.database");

// 扩展插件:挂载即探测;切换数据库后重新探测
const { fetchStatus, enable } = useDbExtensions();
onMounted(fetchStatus);
watch(database, (db) => {
  if (db) fetchStatus();
});

// PostgreSQL特有属性
const pgEncoding = createConfigProp("pg.encoding");
const pgUseJsonB = createConfigProp("pg.useJsonB");
const pgUseArray = createConfigProp("pg.useArray");

// 连接池属性
const poolMin = createConfigProp("pool.min");
const poolMax = createConfigProp("pool.max");
const poolIdleTimeout = createConfigProp("pool.idleTimeoutMillis");
const poolAcquireTimeout = createConfigProp("pool.acquireTimeoutMillis");
const acquireConnectionTimeout = createConfigProp("acquireConnectionTimeout");
</script>

<template>
  <q-card flat bordered class="db-database-panel overflow-auto" dark>
    <q-card-section>
      <div class="text-h6 text-white">数据库配置</div>
    </q-card-section>

    <!-- 统一配置表单 -->
    <q-card-section class="q-pa-md">
      <q-form ref="connectionForm">
        <!-- 连接设置 -->
        <div class="section-header q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold text-white">连接设置</div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input :model-value="host" label="主机" outlined dense dark
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('connection.host')" />
          </div>
          <div class="col-12 col-md-6">
            <q-input :model-value="port" label="端口" outlined dense dark type="number"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('connection.port')" />
          </div>
        </div>

        <div class="row q-col-gutter-md q-mt-xs">
          <div class="col-12 col-md-6">
            <q-input :model-value="user" label="用户名" outlined dense dark
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('connection.user')" />
          </div>
          <div class="col-12 col-md-6">
            <q-input :model-value="password" label="密码" outlined dense dark type="password"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('connection.password')" />
          </div>
        </div>

        <!-- PostgreSQL 特有高级设置 -->
        <div class="section-header q-pt-lg q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold text-white">PostgreSQL 设置</div>
        </div>

        <div class="q-mb-md">
          <div class="row q-col-gutter-md">
            <div class="col-12">
              <q-select v-model="pgEncoding" :options="charsetOptions" label="编码" outlined dense dark emit-value
                map-options />
            </div>
            <div class="col-12 col-md-6">
              <q-toggle v-model="pgUseJsonB" label="JSONB" dense dark />
            </div>
            <div class="col-12 col-md-6">
              <q-toggle v-model="pgUseArray" label="数组" dense dark />
            </div>
          </div>
        </div>

        <!-- 扩展插件(仅 PostgreSQL) -->
        <div class="section-header q-pt-lg q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold text-white">扩展插件</div>
        </div>

        <div v-if="!database" class="text-grey text-caption q-mb-md">请先选择数据库</div>
        <div v-else class="q-mb-md">
          <div v-for="p in PLUGINS" :key="p.name" class="q-mb-sm">
            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <div class="text-white">{{ p.label }}</div>
                <div class="text-grey text-caption">{{ p.desc }}</div>
              </div>
              <div class="col-auto">
                <q-chip v-if="extensionStatus[p.name]?.installed" dense color="positive" text-color="white" icon="check"
                  size="sm">
                  已启用 v{{ extensionStatus[p.name].version }}
                </q-chip>
                <q-chip v-else dense color="grey-8" text-color="white" size="sm">未启用</q-chip>
              </div>
              <div class="col-auto">
                <q-btn dense size="sm" color="primary"
                  :label="extensionStatus[p.name]?.installed ? '重新探测' : '启用'"
                  :loading="enabling === p.name"
                  @click="extensionStatus[p.name]?.installed ? fetchStatus() : enable(p.name)" />
              </div>
            </div>
            <q-banner v-if="extError[p.name]" dense class="bg-red-10 text-white q-mt-xs text-caption">
              {{ extError[p.name] }}
            </q-banner>
          </div>
        </div>

        <!-- 连接池设置 -->
        <div class="section-header q-pt-lg q-pb-md q-mb-md">
          <div class="text-subtitle1 text-weight-bold text-white">连接池设置</div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input :model-value="poolMin" label="最小连接数" outlined dense dark type="number"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('pool.min')" />
          </div>
          <div class="col-12 col-md-6">
            <q-input :model-value="poolMax" label="最大连接数" outlined dense dark type="number"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('pool.max')" />
          </div>
        </div>

        <div class="row q-col-gutter-md q-mt-md">
          <div class="col-12 col-md-6">
            <q-input :model-value="poolIdleTimeout" label="空闲超时 (毫秒)" outlined dense dark type="number"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('pool.idleTimeoutMillis')" />
          </div>
          <div class="col-12 col-md-6">
            <q-input :model-value="poolAcquireTimeout" label="获取超时 (毫秒)" outlined dense dark type="number"
              @update:model-value="(val) => updateTemp(val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="updateFinalValue('pool.acquireTimeoutMillis')" />
          </div>
        </div>

        <div class="q-mt-md">
          <q-input :model-value="acquireConnectionTimeout" label="连接获取超时 (毫秒)" outlined dense dark type="number"
            @update:model-value="(val) => updateTemp(val)"
            @keyup.enter="(e) => e.target.blur()"
            @blur="updateFinalValue('acquireConnectionTimeout')" />
        </div>
      </q-form>
    </q-card-section>

    <q-card-section class="db-database-panel">
      <q-btn label="测试连接" color="primary" @click="handleTestConnection" :disable="!database" />
      <span v-if="!database" class="text-grey q-ml-sm text-caption">请先选择数据库</span>
    </q-card-section>
  </q-card>
</template>

<style>
.db-database-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.db-database-panel .q-card-section:first-child {
  padding-bottom: 0;
}

.section-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
</style>
