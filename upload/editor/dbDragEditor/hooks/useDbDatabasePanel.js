import { ref, computed } from "vue";

import {
  useDbConfig,
  client,
} from "./useDbConfig.js";

import { useDbMetadata } from "./useDbMetadata";
import { useQuasar } from "quasar";
import api from "../../../../services/api.js";

export function useDbDatabasePanel() {
  const $q = useQuasar();
  const { updateConfig, getConfig } = useDbConfig();

  const { getCharsetCollationOptions } = useDbMetadata();

  // 数据库字符集选项（仅 PostgreSQL）
  const charsetOptions = computed(() => {
    return getCharsetCollationOptions("pg", "encoding");
  });


  // 测试数据库连接
  const handleTestConnection = async () => {
    const host = getConfig("connection.host");
    const database = getConfig("connection.database");

    // 验证必填字段
    if (!host) {
      $q.notify({
        type: "negative",
        message: "请先填写主机地址",
      });
      return;
    }
    if (!database) {
      $q.notify({
        type: "negative",
        message: "请先填写数据库名",
      });
      return;
    }

    // 获取当前数据库配置
    const dbConfig = {
      client: "pg",
      connection: {
        host,
        port: getConfig("connection.port"),
        user: getConfig("connection.user"),
        password: getConfig("connection.password"),
        database,
      },
    };

    // 发送测试连接请求
    const response = await api.post("/api/dbbase/test", dbConfig);

    if (response.data.success) {
      $q.notify({
        type: "positive",
        message: response.data.message,
      });
    } else {
      throw new Error(response.data.message);
    }
  };

  // 添加临时变量
  const tempValues = ref(null);
  const hasTempValue = ref(false);

  // 更新临时值（仅在用户实际输入时调用）
  const updateTemp = (value) => {
    tempValues.value = value;
    hasTempValue.value = true;
  };

  // 更新最终值（blur 时调用）
  const updateFinalValue = (path) => {
    if (!hasTempValue.value) return; // 用户没有输入过，跳过
    updateConfig(path, tempValues.value);
    tempValues.value = null;
    hasTempValue.value = false;
  };

  return {
    charsetOptions,

    // DB配置管理器导出的状态
    client,

    updateConfig,
    handleTestConnection,

    // 临时变量
    updateTemp,
    updateFinalValue,
  };
}
