import { ref } from "vue";
import { Notify } from "quasar";
import api from "../../../../services/api.js";
import { useDbConfig } from "./useDbConfig";

// 面板支持的插件元信息(展示用)
export const PLUGINS = [
  { name: "pg_cron", label: "pg_cron", desc: "定时任务 / 物化视图刷新" },
  { name: "pg_partman", label: "pg_partman", desc: "自动分区维护" },
];

// 模块级共享状态
export const extensionStatus = ref({}); // { pg_cron:{installed,version}, pg_partman:{...} }
export const enabling = ref(""); // 正在启用的插件名("" 表示空闲)
export const extError = ref({}); // { [plugin]: 原始报错文本 }

export function useDbExtensions() {
  const { getConfig } = useDbConfig();

  const buildConnConfig = () => ({
    client: "pg",
    connection: {
      host: getConfig("connection.host"),
      port: getConfig("connection.port"),
      user: getConfig("connection.user"),
      password: getConfig("connection.password"),
      database: getConfig("connection.database"),
    },
  });

  // 探测当前库的插件状态(未选库直接跳过)
  const fetchStatus = async () => {
    if (!getConfig("connection.database")) return;
    try {
      const { data } = await api.post(
        "/api/dbbase/extensions/status",
        buildConnConfig()
      );
      if (data.success) extensionStatus.value = data.data;
    } catch (err) {
      console.warn("探测扩展状态失败:", err.message);
    }
  };

  // 启用插件;成功刷新该行状态,失败把原始报错存入 extError 行内展示
  const enable = async (plugin) => {
    enabling.value = plugin;
    extError.value = { ...extError.value, [plugin]: "" };
    try {
      const { data } = await api.post("/api/dbbase/extensions/enable", {
        ...buildConnConfig(),
        plugin,
      });
      if (!data.success) throw new Error(data.message);
      extensionStatus.value = {
        ...extensionStatus.value,
        [plugin]: { installed: data.data.installed, version: data.data.version },
      };
      Notify.create({
        type: "positive",
        position: "top",
        message: `${plugin} 已启用 (v${data.data.version})`,
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      extError.value = { ...extError.value, [plugin]: msg };
      Notify.create({ type: "negative", position: "top", message: `启用 ${plugin} 失败` });
    } finally {
      enabling.value = "";
    }
  };

  return { fetchStatus, enable };
}
