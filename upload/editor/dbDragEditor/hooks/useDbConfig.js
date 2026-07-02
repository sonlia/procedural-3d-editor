/**
 * 数据库配置钩子函数 - 组合式API方式实现
 */
import { ref, watch, computed } from "vue";
import { useDbMetadata } from "./useDbMetadata";
import { set, get, cloneDeep } from "lodash-es";
import { uid, Notify } from "quasar";
import { graphIns, useGraphEditor, canvasIns } from "./useDbGraphEditor";
import { dbTreeManager } from "./useDbTreeManager";

import api from "../../../../services/api.js";
import { useProjectStore } from "../../../../stores/projectMange.js";
import { updateEnv } from "../../../../services/http/projectApi.js";
// 使用模块级变量共享状态，避免闭包问题
export const client = ref("pg");
// 当前图形ID
export const currentGraphId = ref("");
// 当前选中树节点
export const currentSelectTreeNode = ref(null);
// 当前节点数据（属性面板展示用）
export const nodeData = ref({});
// graph 加载状态（true=加载中）
export const graphLoading = computed(() => graphIns.value?.reload ?? false);

// 延迟初始化 dbTreeManager，避免循环依赖
let _manager = null;
const getManager = () => {
  if (!_manager) _manager = dbTreeManager();
  return _manager;
};
const { getDefaultDbConfig } = useDbMetadata();
/**
 * 数据库配置钩子
 */
export function useDbConfig() {
  //tree 选中 node,如果 非数据库节点，则原始数据 需要 查找 graph node 获取
  const selectNode = (treeNode) => {
    currentSelectTreeNode.value = treeNode;
    // 如果是 目录节点
    if (treeNode.type === getManager().NODE_TYPES.FOLDER) return;
    // 如果选中的是数据库节点,先检测当前 graph 是否是选中节点的graph

    const dbnode = getManager().findNearestParentByType(
      treeNode,
      getManager().NODE_TYPES.DATABASE,
    );
    if (!dbnode) return;
    if (currentGraphId.value !== dbnode.id) {
      currentGraphId.value = dbnode.id;
      const projectStore = useProjectStore();
      const graphData = projectStore.getDbEditorData(dbnode.id, 'graphData');
      client.value = graphData?.extra?.client;
      graphIns.value.reload = true;
      loadGraph(graphData);
    }

    // 如果选中的是数据库节点
    if (treeNode.type === getManager().NODE_TYPES.DATABASE) {
      const init = get(graphIns.value, "extra", {});
      if (Object.keys(init).length === 0) {
        init.type = getManager().NODE_TYPES.DATABASE;
        init.client = "pg";
        client.value = init.client;
      }
      // 修复被 tempValues null bug 破坏的数据：将 null 连接字段回填默认值并持久化
      const defaults = getDefaultDbConfig(init.client || "pg");
      if (!init.connection) init.connection = {};
      let patched = false;
      for (const key of Object.keys(defaults.connection)) {
        if (init.connection[key] == null) {
          // database 为空时用节点名作为 fallback（节点名即数据库名）
          if (key === 'database') {
            init.connection[key] = treeNode.name;
            patched = true;
            continue;
          }
          init.connection[key] = defaults.connection[key];
          patched = true;
        }
      }
      if (patched) {
        set(graphIns.value, "extra", init);
        const projectStore = useProjectStore();
        projectStore.updateDbEditorData(currentGraphId.value, 'graphData', graphIns.value.serialize());
        getManager().saveTreeData();
      }
      updateNodeConfig(init);
    }
    // 如果选中的是表节点
    if (treeNode.type === getManager().NODE_TYPES.TABLE) {
      const n = graphIns.value.getNodeById(treeNode.id);

      updateNodeConfig({ ...n?.properties, fieldList: n?.inputs });
    }
    // 如果选中的是字段节点
    if (treeNode.type === getManager().NODE_TYPES.FIELD) {
      const currentTableNode = getManager().findNearestParentByType(
        treeNode,
        getManager().NODE_TYPES.TABLE,
      );

      const n = graphIns.value.getNodeById(currentTableNode.id);
      const fieldConfig = get(n, `properties.field.${treeNode.id}`, {});

      // 向后兼容：旧数据格式迁移
      let migrated = false;
      if (fieldConfig.fieldType === "increments") {
        fieldConfig.fieldType = "integer";
        fieldConfig.autoIncrement = true;
        fieldConfig.primary = true;
        fieldConfig.notNullable = true;
        migrated = true;
      }
      if (fieldConfig.fieldType === "rawType") {
        fieldConfig.fieldType = "specificType";
        if (fieldConfig.rawTypeValue) {
          if (!fieldConfig.typeParams) fieldConfig.typeParams = {};
          fieldConfig.typeParams.rawType = fieldConfig.rawTypeValue;
        }
        migrated = true;
      }
      if (fieldConfig.fieldType === "datetime") {
        fieldConfig.fieldType = "timestamp";
        migrated = true;
      }
      if (migrated) {
        set(n, `properties.field.${treeNode.id}`, fieldConfig);
        graphIns.value.change();
      }

      updateNodeConfig(fieldConfig);
    }
  };

  const updateNodeConfig = (nodeConfig) => {
    // 深拷贝 node.properties,避免不响应
    if (nodeConfig) {
      nodeData.value = JSON.parse(JSON.stringify(nodeConfig));
    }
  };

  const loadGraph = (data) => {
    graphIns.value.clear();
    graphIns.value.configure(data);
    graphIns.value.reload = false;
  };
  // 获取配置
  const getConfig = (path) => {
    const currentValue = get(nodeData.value, path);

    // 仅在值为 undefined/null 时返回默认值（不写回 graphIns）
    if (currentValue === undefined || currentValue === null) {
      const defaultValue = get(getDefaultDbConfig(client.value), path);
      if (defaultValue !== undefined) {
        return defaultValue;
      }
    }

    return currentValue;
  };
  // 更新配置
  const updateConfig = async (path, value, refreshNodeData = true) => {
    if (currentSelectTreeNode.value.type === getManager().NODE_TYPES.DATABASE) {
      set(graphIns.value, `extra.${path}`, value);

      const projectStore = useProjectStore();
      projectStore.updateDbEditorData(currentGraphId.value, 'graphData', graphIns.value.serialize());
      await getManager().saveTreeData();

      // 同步 connection.* 到项目后端 .env
      if (path.startsWith('connection.')) {
        const conn = graphIns.value?.extra?.connection || {};
        const { host, port, user, password, database } = conn;
        if (host && database) {
          const project = projectStore.currentProject;
          if (project?.rootDir) {
            const databaseUrl = `postgresql://${user || ''}:${password || ''}@${host}:${port || 5432}/${database}`;
            updateEnv(projectStore.currentProjectId, project.rootDir, { DATABASE_URL: databaseUrl });
          }
        }
      }
    } else if (currentSelectTreeNode.value.type === getManager().NODE_TYPES.TABLE) {
      const n = graphIns.value.getNodeById(currentSelectTreeNode.value.id);

      if (path === "indexFields") {
        const projectStore = useProjectStore();
        await api.put(`/api/db/table/indexes`, {
          serverDbId: currentGraphId.value,
          tableName: currentSelectTreeNode.value.name,
          indexFields: value,
          projectId: projectStore.currentProjectId,
        });
      }
      set(n, `properties.${path}`, value);
    } else if (currentSelectTreeNode.value.type === getManager().NODE_TYPES.FIELD) {
      const currentTableNode = getManager().findNearestParentByType(
        currentSelectTreeNode.value,
        getManager().NODE_TYPES.TABLE,
      );

      const n = graphIns.value.getNodeById(currentTableNode.id);
      const fieldPath = `properties.field.${currentSelectTreeNode.value.id}`;

      // 保存原始状态，用于 API 失败时回滚
      const originalFieldConfig = cloneDeep(get(n, fieldPath));

      set(n, `${fieldPath}.${path}`, value);

      // 适配后端字段属性接口
      const projectStore = useProjectStore();
      const req = {
        serverDbId: currentGraphId.value,
        tableName: currentTableNode.name,
        fieldName: currentSelectTreeNode.value.name,
        projectId: projectStore.currentProjectId,
      };

      if (path === "fieldType") {
        req.fieldType = value;
        // 获取新类型的 typeParams 默认值
        const { getFieldTypeDef } = useDbMetadata();
        const typeDef = getFieldTypeDef(value);
        const defaultParams = {};
        if (typeDef?.params) {
          for (const [key, paramDef] of Object.entries(typeDef.params)) {
            defaultParams[key] = paramDef.default;
          }
        }
        // 重置类型相关属性
        set(n, `${fieldPath}.typeParams`, defaultParams);
        set(n, `${fieldPath}.defaultValue`, "");
        set(n, `${fieldPath}.defaultValueType`, "none");
        // 如果从 autoIncrement 类型切换走，清除 autoIncrement
        if (!["integer", "bigInteger"].includes(value)) {
          set(n, `${fieldPath}.autoIncrement`, false);
        }
        // 将 typeParams 传给后端
        req.typeParams = defaultParams;
      } else if (path === "autoIncrement") {
        req.autoIncrement = value;
        // 自增联动：勾选时锁定主键+非空
        if (value) {
          set(n, `${fieldPath}.primary`, true);
          set(n, `${fieldPath}.notNullable`, true);
          set(n, `${fieldPath}.defaultValue`, "");
          set(n, `${fieldPath}.defaultValueType`, "none");
        }
      } else if (path === "primary") {
        req.isPrimaryKey = value;
        // 主键联动：勾选时自动勾选非空
        if (value) {
          set(n, `${fieldPath}.notNullable`, true);
        }
      } else if (path === "unique") {
        req.isUnique = value;
      } else if (path === "notNullable") {
        req.isNotNull = value;
      } else if (path === "defaultValue") {
        req.defaultValue = value;
      } else if (path.startsWith("typeParams.")) {
        // typeParams 的子属性变更 → 发送 fieldType + 完整 typeParams
        const currentFieldType = get(n, `${fieldPath}.fieldType`);
        const currentParams = get(n, `${fieldPath}.typeParams`) || {};
        req.fieldType = currentFieldType;
        req.typeParams = currentParams;
      } else {
        // defaultValueType, comment 等仅本地保存，不发后端
        graphIns.value.change();
        if (refreshNodeData) {
          selectNode(currentSelectTreeNode.value);
        }
        return;
      }

      try {
        await api.put(`/api/db/field/type`, req);
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        Notify.create({
          type: "negative",
          message: msg,
          position: "top",
        });
        // 恢复原始状态并刷新 UI
        set(n, fieldPath, originalFieldConfig);
        selectNode(currentSelectTreeNode.value);
        return;
      }
    }
    graphIns.value.change();
    // 更新UI显示
    if (refreshNodeData) {
      selectNode(currentSelectTreeNode.value);
    }
  };

  return {
    // 方法
    updateConfig,
    getConfig,

    selectNode,
  };
}
