/**
 * 表分区管理 hook
 *
 * 收敛 dbDragEditor 分区相关的 API 调用与状态。
 * serverDbId = currentGraphId（数据库节点ID），tableName = currentSelectTreeNode.name，
 * projectId 取自 projectStore —— 与索引/字段更新同源。
 *
 * 三层调度分工：维护逻辑(预建+保留)走数据库层 pg_cron（与物化视图刷新一致），
 * 不再用 pg-boss 任务。native 自动管理用自研 plpgsql 函数 vs_partition_maintenance()，
 * partman（探测到扩展才可选）用 run_maintenance_proc。
 */
import { ref } from "vue";
import { Notify } from "quasar";
import api from "../../../../services/api.js";
import { useProjectStore } from "../../../../stores/projectMange.js";
import { currentGraphId, currentSelectTreeNode } from "./useDbConfig";

// 分区策略选项（供建表对话框 / 面板使用）
export const PARTITION_STRATEGIES = [
  { value: "range", label: "RANGE 范围", desc: "按值区间分区（如按时间）" },
  { value: "list", label: "LIST 列表", desc: "按枚举值分区（如按地区）" },
  { value: "hash", label: "HASH 哈希", desc: "按哈希取模均匀分布" },
];

// 原生自研自动管理仅支持 RANGE（只有 RANGE 需随时间/序号滚动预建）
export function canAutoManage(strategy) {
  return strategy === "range";
}

// partman 可托管的策略（HASH 不支持；LIST 仅整数键）
export function canUsePartman(strategy, keyIsInteger) {
  if (strategy === "range") return true;
  if (strategy === "list") return !!keyIsInteger;
  return false;
}

// 模块级共享状态：当前选中表的分区信息
export const partitionInfo = ref({ partitioned: false });

export function useDbPartitionManager() {
  const getCtx = () => {
    const projectStore = useProjectStore();
    return {
      serverDbId: currentGraphId.value,
      tableName: currentSelectTreeNode.value?.name,
      projectId: projectStore.currentProjectId,
    };
  };

  // 拉取当前表的分区信息
  const fetchInfo = async () => {
    const { serverDbId, tableName, projectId } = getCtx();
    if (!serverDbId || !tableName) {
      partitionInfo.value = { partitioned: false };
      return partitionInfo.value;
    }
    try {
      const { data: result } = await api.get(`/api/db/table/partition-info`, {
        params: { serverDbId, tableName, projectId },
      });
      partitionInfo.value = result.success ? result.data : { partitioned: false };
    } catch (err) {
      console.warn("获取分区信息失败:", err.message);
      partitionInfo.value = { partitioned: false };
    }
    return partitionInfo.value;
  };

  // 新建子分区
  const addPartition = async ({ partitionName, strategy, bound }) => {
    const { serverDbId, tableName, projectId } = getCtx();
    try {
      await api.post(`/api/db/table/partition`, {
        serverDbId,
        tableName,
        partitionName,
        strategy,
        bound,
        projectId,
      });
      Notify.create({ type: "positive", position: "top", message: `分区 '${partitionName}' 创建成功` });
      await fetchInfo();
      return true;
    } catch (err) {
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建分区失败: ${err.response?.data?.message || err.message}`,
      });
      return false;
    }
  };

  // 删除子分区
  const dropPartition = async (partitionName) => {
    const { serverDbId, projectId } = getCtx();
    try {
      await api.delete(`/api/db/table/partition`, {
        data: { serverDbId, partitionName, projectId },
      });
      Notify.create({ type: "info", position: "top", message: `分区 '${partitionName}' 已删除` });
      await fetchInfo();
      return true;
    } catch (err) {
      Notify.create({
        type: "negative",
        position: "top",
        message: `删除分区失败: ${err.response?.data?.message || err.message}`,
      });
      return false;
    }
  };

  // 更新分区配置（interval/premake/retention）
  const updatePartitionConfig = async (patch) => {
    const { serverDbId, tableName, projectId } = getCtx();
    try {
      await api.put(`/api/db/table/partition/config`, {
        serverDbId,
        tableName,
        projectId,
        ...patch,
      });
      Notify.create({ type: "positive", position: "top", message: "分区配置已更新" });
      await fetchInfo();
      return true;
    } catch (err) {
      Notify.create({
        type: "negative",
        position: "top",
        message: `更新分区配置失败: ${err.response?.data?.message || err.message}`,
      });
      return false;
    }
  };

  // 设置维护定时（pg_cron）
  const setSchedule = async (cron) => {
    const { serverDbId, tableName, projectId } = getCtx();
    try {
      await api.put(`/api/db/table/partition/schedule`, {
        serverDbId,
        tableName,
        cron,
        projectId,
      });
      Notify.create({ type: "positive", position: "top", message: `维护定时已设置 (${cron})` });
      await fetchInfo();
      return true;
    } catch (err) {
      Notify.create({
        type: "negative",
        position: "top",
        message: `设置维护定时失败: ${err.response?.data?.message || err.message}`,
      });
      return false;
    }
  };

  // 立即维护（预建未来分区 + 清理过期分区）
  const runMaintenance = async () => {
    const { serverDbId, tableName, projectId } = getCtx();
    try {
      await api.post(`/api/db/table/partition/maintain`, {
        serverDbId,
        tableName,
        projectId,
      });
      Notify.create({ type: "positive", position: "top", message: "分区维护已执行" });
      await fetchInfo();
      return true;
    } catch (err) {
      Notify.create({
        type: "negative",
        position: "top",
        message: `分区维护失败: ${err.response?.data?.message || err.message}`,
      });
      return false;
    }
  };

  return {
    partitionInfo,
    fetchInfo,
    addPartition,
    dropPartition,
    updatePartitionConfig,
    setSchedule,
    runMaintenance,
  };
}
