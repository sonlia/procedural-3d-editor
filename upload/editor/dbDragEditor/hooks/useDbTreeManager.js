/**
 * 数据库树管理器 - 组合式API
 * 用于管理数据库树操作，替代事件订阅机制
 *
 * 数据存储：project_json.dbTree
 */
import { ref, computed } from "vue";
import { uid, Notify } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import { set } from "lodash-es";
import { useDbConfig, currentSelectTreeNode } from "./useDbConfig";
import { canvasIns, useGraphEditor, graphIns } from "./useDbGraphEditor";
import api from "../../../../services/api.js";
import { useProjectStore } from "../../../../stores/projectMange.js";
import { patchModuleSnapshot } from "../../../../services/projectSync.js";
import { flatToNested, nestedToFlat, findNodeById, addChildNode, removeNodeById, getNodePath } from "../../../../utils/treeUtils.js";
import { useDbMetadata } from "./useDbMetadata";
import { assembleRoutineDefinition, defaultRoutineBody } from "../graph/routineBody.js";

// QTree 响应式状态
export const treeNodes = ref([]);
export const selectedId = ref(null);
export const expandedIds = ref([]);

const isLoading = ref(false);

// 节点类型
const NODE_TYPES = {
  ROOT: "root",
  FOLDER: "folder",
  DATABASE: "dbbase",
  TABLE: "table",
  FIELD: "field",
  VIEW: "view",
  MATERIALIZED_VIEW: "materialized_view",
  FUNCTION_ROOT: "function_root",
  PROCEDURE_ROOT: "procedure_root",
  SCHEDULED_TASK_ROOT: "scheduled_task_root",
  PROCEDURE: "procedure",
  FUNCTION: "function",
  COMPUTED: "computed_column",
  REDIS: "redis",
  REDIS_DB: "redis_db",
  SCHEDULED_TASK: "scheduled_task",
};

// 系统默认字段定义（每个表自动包含）
const SYSTEM_FIELDS = [
  { name: "id", fieldType: "integer", autoIncrement: true, primary: true, notNullable: true },
  { name: "created_at", fieldType: "timestamp", defaultValue: "CURRENT_TIMESTAMP" },
  { name: "updated_at", fieldType: "timestamp", defaultValue: "CURRENT_TIMESTAMP" },
];

const DB_DEFAULT_ROOTS = [
  { type: NODE_TYPES.FUNCTION_ROOT, name: "函数", iconSkin: "function_root" },
  { type: NODE_TYPES.PROCEDURE_ROOT, name: "存储过程", iconSkin: "procedure_root" },
  { type: NODE_TYPES.SCHEDULED_TASK_ROOT, name: "定时任务", iconSkin: "scheduled_task_root" },
];

// 延迟初始化 dbConfig，避免循环依赖
let _dbConfig = null;
const getDbConfig = () => {
  if (!_dbConfig) _dbConfig = useDbConfig();
  return _dbConfig;
};

// 延迟初始化 graphEditor，避免循环依赖
let _graphEditor = null;
const getGraphEditor = () => {
  if (!_graphEditor) _graphEditor = useGraphEditor();
  return _graphEditor;
};

/**
 * 将可能是嵌套或扁平的数据统一转为 QTree 嵌套格式
 */
function normalizeTreeData(data) {
  if (!data?.length) return [];

  // 检查是否已经是嵌套格式（旧保存格式）
  const hasNestedChildren = data.some(n => n.children?.length > 0);

  if (hasNestedChildren) {
    const walk = (nodes) => nodes.map(n => ({
      ...n,
      label: n.label || n.name,
      children: n.children ? walk(n.children) : [],
    }));
    return walk(data);
  }

  // 扁平 pId 格式，转换为嵌套
  return flatToNested(data);
}

export const dbTreeManager = () => {
  const { getDefaultDbConfig } = useDbMetadata();

  // 查找指定节点
  const findNode = (nodeId) => {
    const found = findNodeById(treeNodes.value, nodeId);
    return found ? found.node : null;
  };

  // 查找最近的特定类型父节点（含自身）
  const findNearestParentByType = (_node, type) => {
    const path = getNodePath(treeNodes.value, _node.id);
    // 从末尾（当前节点）向根节点遍历
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].type === type) return path[i];
    }
    return null;
  };

  const resolveDatabaseNode = (node) => {
    return node?.type === NODE_TYPES.DATABASE
      ? node
      : findNearestParentByType(node, NODE_TYPES.DATABASE);
  };

  const ensureDatabaseDefaultRoots = (dbNode) => {
    if (!dbNode) return false;

    let changed = false;
    dbNode.children = dbNode.children || [];

    for (const root of DB_DEFAULT_ROOTS) {
      let rootNode = dbNode.children.find(child => child.type === root.type);
      if (!rootNode) {
        rootNode = {
          id: `${dbNode.id}_${root.type}`,
          pId: dbNode.id,
          name: root.name,
          label: root.name,
          type: root.type,
          isParent: true,
          iconSkin: root.iconSkin,
          system: true,
          children: [],
        };
        dbNode.children.push(rootNode);
        changed = true;
      } else {
        const before = JSON.stringify({
          pId: rootNode.pId,
          name: rootNode.name,
          label: rootNode.label,
          isParent: rootNode.isParent,
          iconSkin: rootNode.iconSkin,
          system: rootNode.system,
        });
        rootNode.pId = dbNode.id;
        rootNode.name = root.name;
        rootNode.label = root.name;
        rootNode.isParent = true;
        rootNode.iconSkin = root.iconSkin;
        rootNode.system = true;
        rootNode.children = rootNode.children || [];
        changed = changed || before !== JSON.stringify({
          pId: rootNode.pId,
          name: rootNode.name,
          label: rootNode.label,
          isParent: rootNode.isParent,
          iconSkin: rootNode.iconSkin,
          system: rootNode.system,
        });
      }
    }

    return changed;
  };

  const findDatabaseDefaultRoot = (dbNode, rootType) => {
    ensureDatabaseDefaultRoots(dbNode);
    return dbNode?.children?.find(child => child.type === rootType) || null;
  };

  // 生成目录名
  const generateName = (name) => {
    return `${name}_${uid().substring(0, 6)}`;
  };

  // 添加目录节点
  const addFolderNode = (parentNode) => {
    const folderName = generateName("NewFolder");
    const folderId = uid();

    const folderNodeData = {
      id: folderId,
      pId: parentNode.id,
      name: folderName,
      label: folderName,
      type: NODE_TYPES.FOLDER,
      isParent: true,
      iconSkin: "folder",
      children: [],
    };
    addChildNode(treeNodes.value, parentNode.id, folderNodeData);
    return folderNodeData;
  };

  // 添加数据库节点
  const addDatabaseNode = async (serverNode) => {
    if (!serverNode) return null;

    const dbName = generateName("NewDatabase");
    const dbId = uid();

    try {
      const defaultConfig = getDefaultDbConfig("pg");
      const graphData = {
        extra: {
          ...defaultConfig,
          connection: {
            ...defaultConfig.connection,
            database: dbName,
          },
          type: NODE_TYPES.DATABASE,
        },
      };
      const dbNodeData = {
        id: dbId,
        pId: serverNode.id,
        name: dbName,
        label: dbName,
        type: NODE_TYPES.DATABASE,
        isParent: true,
        iconSkin: "database",
        children: [],
      };
      ensureDatabaseDefaultRoots(dbNodeData);
      addChildNode(treeNodes.value, serverNode.id, dbNodeData);
      const projectStore = useProjectStore();
      projectStore.updateDbEditorData(dbId, 'graphData', graphData);
      Notify.create({
        type: "info",
        position: "top",
        message: `数据库节点 '${dbName}' 已添加，请配置连接信息`,
      });
      saveTreeData();
      return dbNodeData;
    } catch (error) {
      console.error("创建数据连接库失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建数据库连接 '${dbName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加表节点（partition 非空时建分区表；presetName 用于分区表按用户指定名建立，避免后续重命名导致 partman 配置失配）
  const addTableNode = async (dbNode, partition = null, presetName = null) => {
    if (!dbNode) return null;

    const tableName = presetName || generateName("NewTable");
    const tableId = uid();

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    try {
      await _saveTreeDataImpl();

      await api.post(`/api/db/table`, {
        serverDbId: dbNode.id,
        name: tableName,
        projectId,
        ...(partition ? { partition } : {}),
      });

      const tableNodeData = {
        id: tableId,
        pId: dbNode.id,
        name: tableName,
        label: tableName,
        type: NODE_TYPES.TABLE,
        isParent: true,
        iconSkin: partition ? "partitioned_table" : "table",
        children: [],
      };
      addChildNode(treeNodes.value, dbNode.id, tableNodeData);
      createGraphNodeForTable(tableId, tableName, !!partition);

      // 添加系统默认字段（id, created_at, updated_at）作为树子节点
      // 获取图形节点，为系统字段 slot 设置 id 并写入字段配置
      const graphNode = graphIns.value?.getNodeById(tableId);
      for (const sf of SYSTEM_FIELDS) {
        const fieldId = uid();
        const fieldNodeData = {
          id: fieldId,
          pId: tableId,
          name: sf.name,
          label: sf.name,
          type: NODE_TYPES.FIELD,
          iconSkin: "field",
          system: true,
          children: [],
        };
        addChildNode(treeNodes.value, tableId, fieldNodeData);
        // 同步 slot id 到图形节点（构造函数已创建 slot，只需设置 id）
        if (graphNode) {
          const inIdx = graphNode.findInputSlot(sf.name);
          if (inIdx !== -1) graphNode.inputs[inIdx].id = fieldId;
          const outIdx = graphNode.findOutputSlot(sf.name);
          if (outIdx !== -1) graphNode.outputs[outIdx].id = fieldId;

          // 写入字段配置到 graph 节点 properties
          set(graphNode, `properties.field.${fieldId}`, {
            fieldType: sf.fieldType,
            autoIncrement: sf.autoIncrement || false,
            primary: sf.primary || false,
            notNullable: sf.notNullable || false,
            defaultValue: sf.defaultValue || "",
          });
        }
      }

      Notify.create({
        type: "positive",
        position: "top",
        message: `表 '${tableName}' 创建成功`,
      });
      saveTreeData();
      return tableNodeData;
    } catch (error) {
      console.error("创建表失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建表 '${tableName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加字段节点
  const addFieldNode = async (tableNode) => {
    if (!tableNode) return null;

    const fieldName = generateName("NewField");
    const fieldId = uid();

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
    const parentTableNode = findNearestParentByType(tableNode, NODE_TYPES.TABLE);
    if (!dbNode) {
      Notify.create({
        type: "negative",
        message: "无法找到所属数据库节点",
        position: "top",
      });
      return null;
    }

    try {
      await _saveTreeDataImpl();

      await api.post(`/api/db/field`, {
        serverDbId: dbNode.id,
        tableName: parentTableNode.name,
        fieldName: fieldName,
        projectId,
      });

      const fieldNodeData = {
        id: fieldId,
        pId: tableNode.id,
        name: fieldName,
        label: fieldName,
        type: NODE_TYPES.FIELD,
        iconSkin: "field",
        children: [],
      };
      addChildNode(treeNodes.value, tableNode.id, fieldNodeData);
      getGraphEditor().addSlot(tableNode.id, fieldName, fieldId);

      Notify.create({
        type: "positive",
        position: "top",
        message: `字段 '${fieldName}' 创建成功`,
      });
      _saveTreeDataImpl();
      return fieldNodeData;
    } catch (error) {
      console.error("创建字段失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建字段 '${fieldName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加列计算(生成列)节点 —— 表的子节点;默认 GENERATED ALWAYS AS ("id") STORED
  // (每张表必有 id 系统字段,保证默认生成列合法,用户再在编辑区改类型与表达式)
  const addComputedColumnNode = async (tableNode) => {
    if (!tableNode) return null;

    const columnName = generateName("NewComputed");
    const columnId = uid();

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
    const parentTableNode = findNearestParentByType(tableNode, NODE_TYPES.TABLE);
    if (!dbNode || !parentTableNode) {
      Notify.create({
        type: "negative",
        message: "无法找到所属数据库或表节点",
        position: "top",
      });
      return null;
    }

    try {
      await _saveTreeDataImpl();

      await api.post(`/api/db/computed-column`, {
        serverDbId: dbNode.id,
        tableName: parentTableNode.name,
        columnName,
        columnType: "integer",
        expression: '"id"',
        projectId,
      });

      const computedNodeData = {
        id: columnId,
        pId: tableNode.id,
        name: columnName,
        label: columnName,
        type: NODE_TYPES.COMPUTED,
        iconSkin: "computed_column",
        children: [],
      };
      addChildNode(treeNodes.value, tableNode.id, computedNodeData);

      Notify.create({
        type: "positive",
        position: "top",
        message: `列计算 '${columnName}' 创建成功`,
      });
      _saveTreeDataImpl();
      return computedNodeData;
    } catch (error) {
      console.error("创建列计算失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建列计算 '${columnName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加 Redis 节点
  const addRedisNode = (parentNode) => {
    if (!parentNode) return null;

    const redisName = generateName("Redis");
    const redisId = uid();

    const redisConfig = {
      host: "localhost",
      port: 6379,
      password: "",
    };

    const redisNodeData = {
      id: redisId,
      pId: parentNode.id,
      name: redisName,
      label: redisName,
      type: NODE_TYPES.REDIS,
      isParent: true,
      iconSkin: "redis",
      children: [],
    };

    addChildNode(treeNodes.value, parentNode.id, redisNodeData);
    const projectStore = useProjectStore();
    projectStore.updateDbEditorData(redisId, 'graphData', {
      extra: { type: NODE_TYPES.REDIS, ...redisConfig },
    });

    // 自动添加 16 个数据库索引子节点 (db0-db15)
    for (let i = 0; i < 16; i++) {
      const dbNodeId = `${redisId}_db${i}`;
      const dbNodeData = {
        id: dbNodeId,
        pId: redisId,
        name: `db${i}`,
        label: `db${i}`,
        type: NODE_TYPES.REDIS_DB,
        isParent: false,
        iconSkin: "redis_db",
        children: [],
      };
      addChildNode(treeNodes.value, redisId, dbNodeData);
      projectStore.updateDbEditorData(dbNodeId, 'graphData', {
        extra: { type: NODE_TYPES.REDIS_DB, dbIndex: i, ...redisConfig },
      });
    }

    Notify.create({
      type: "positive",
      position: "top",
      message: `Redis 连接 '${redisName}' 添加成功`,
    });
    return redisNodeData;
  };

  // 添加视图节点
  // 添加视图节点 —— 可从数据库节点或表节点右键创建。
  // 视图始终归属到所属数据库节点;从表创建时种子定义为 SELECT * FROM "本表"。
  const addViewNode = async (fromNode, viewType = "view") => {
    if (!fromNode) return null;

    const dbNode = findNearestParentByType(fromNode, NODE_TYPES.DATABASE);
    if (!dbNode) {
      Notify.create({
        type: "negative",
        message: "无法找到所属数据库节点",
        position: "top",
      });
      return null;
    }

    const viewName = generateName("NewView");
    const viewId = uid();

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    // 从表节点创建时,用 SELECT * FROM 本表 作为种子定义
    const tableNode = fromNode.type === NODE_TYPES.TABLE ? fromNode : null;
    const definition = tableNode ? `SELECT * FROM "${tableNode.name}"` : "SELECT 1";

    try {
      await _saveTreeDataImpl();

      await api.post(`/api/db/view`, {
        serverDbId: dbNode.id,
        name: viewName,
        definition,
        type: viewType,
        projectId,
      });

      const nodeType = viewType === "materialized" ? NODE_TYPES.MATERIALIZED_VIEW : NODE_TYPES.VIEW;
      const viewNodeData = {
        id: viewId,
        pId: fromNode.id,
        name: viewName,
        label: viewName,
        type: nodeType,
        iconSkin: viewType === "materialized" ? "materialized_view" : "view",
        children: [],
      };

      addChildNode(treeNodes.value, fromNode.id, viewNodeData);

      Notify.create({
        type: "positive",
        position: "top",
        message: `${viewType === "materialized" ? "物化视图" : "视图"} '${viewName}' 创建成功`,
      });
      saveTreeData();
      return viewNodeData;
    } catch (error) {
      console.error("创建视图失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建视图 '${viewName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加存储过程/函数节点
  const addProcedureNode = async (fromNode, procType = "function") => {
    if (!fromNode) return null;

    const dbNode = resolveDatabaseNode(fromNode);
    if (!dbNode) {
      Notify.create({ type: "negative", message: "无法找到所属数据库节点", position: "top" });
      return null;
    }

    const procName = generateName(procType === "procedure" ? "NewProcedure" : "NewFunction");
    const procId = uid();

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    const kind = procType === "procedure" ? "PROCEDURE" : "FUNCTION";
    const defaultDefinition = assembleRoutineDefinition({
      kind,
      name: procName,
      language: "plpgsql",
      body: defaultRoutineBody({ kind, language: "plpgsql" }),
    });

    try {
      await _saveTreeDataImpl();

      await api.post(`/api/db/procedure`, {
        serverDbId: dbNode.id,
        name: procName,
        definition: defaultDefinition,
        type: procType,
        projectId,
      });

      const nodeType = procType === "procedure" ? NODE_TYPES.PROCEDURE : NODE_TYPES.FUNCTION;
      const parentRootType = procType === "procedure" ? NODE_TYPES.PROCEDURE_ROOT : NODE_TYPES.FUNCTION_ROOT;
      const parentRootNode = findDatabaseDefaultRoot(dbNode, parentRootType);
      const procNodeData = {
        id: procId,
        pId: parentRootNode.id,
        name: procName,
        label: procName,
        type: nodeType,
        iconSkin: procType === "procedure" ? "procedure" : "function",
        children: [],
      };

      addChildNode(treeNodes.value, parentRootNode.id, procNodeData);

      Notify.create({
        type: "positive",
        position: "top",
        message: `${procType === "procedure" ? "存储过程" : "函数"} '${procName}' 创建成功`,
      });
      saveTreeData();
      return procNodeData;
    } catch (error) {
      console.error("创建存储过程失败 (API):", error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `创建${procType === "procedure" ? "存储过程" : "函数"} '${procName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return null;
    }
  };

  // 添加定时任务节点 —— 始终归属数据库节点,与表/存储过程同级;SQL 存项目数据 editors[id].sql
  const addScheduledTaskNode = (fromNode) => {
    if (!fromNode) return null;

    const dbNode = resolveDatabaseNode(fromNode);
    if (!dbNode) {
      Notify.create({ type: "negative", message: "无法找到所属数据库节点", position: "top" });
      return null;
    }

    const taskName = generateName("NewTask");
    const taskId = uid();

    const seedSql =
      "-- 在此编写定时逻辑(自动包成 DO 匿名块执行,用 plpgsql 写法):\n" +
      "-- INSERT INTO target_table (col_a, col_b)\n" +
      "-- SELECT col_a, col_b FROM source_table\n" +
      "-- WHERE created_at >= now() - interval '1 day';";

    const taskRootNode = findDatabaseDefaultRoot(dbNode, NODE_TYPES.SCHEDULED_TASK_ROOT);
    const taskNodeData = {
      id: taskId,
      pId: taskRootNode.id,
      name: taskName,
      label: taskName,
      type: NODE_TYPES.SCHEDULED_TASK,
      iconSkin: "scheduled_task",
      children: [],
    };
    addChildNode(treeNodes.value, taskRootNode.id, taskNodeData);

    const projectStore = useProjectStore();
    projectStore.updateDbEditorData(taskId, "sql", seedSql);

    Notify.create({ type: "positive", position: "top", message: `定时任务 '${taskName}' 创建成功` });
    saveTreeData();
    return taskNodeData;
  };

  // 删除节点
  const removeNode = async (nodeId, isSilent = false) => {
    const node = findNode(nodeId);
    if (!node) return false;

    // 系统字段不可删除
    if (node.system) {
      if (!isSilent) {
        Notify.create({ type: "warning", message: "系统字段不可删除", position: "top" });
      }
      return false;
    }

    if (isSilent) {
      removeNodeById(treeNodes.value, nodeId);
      return true;
    }

    if (node.pId === null || node.id === NODE_TYPES.ROOT) {
      Notify.create({
        type: "warning",
        message: "根节点不可删除",
        position: "top",
      });
      return false;
    }

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    let success = false;
    let syncTableIds = []; // 用于 DB Table Node 同步
    try {
      if (node.type === NODE_TYPES.DATABASE) {
        const graphData = projectStore.getDbEditorData(node.id, 'graphData');
        const connectionConfig = graphData?.extra?.connection;
        const hasCompleteConfig =
          connectionConfig?.host &&
          connectionConfig?.database &&
          connectionConfig?.user;

        if (hasCompleteConfig) {
          try {
            await api.delete(`/api/db/dbbase`, {
              data: {
                serverDbId: node.id,
                dbName: connectionConfig.database,
                projectId,
              },
            });
          } catch (apiError) {
            console.warn(
              `删除远程数据库失败，将只删除本地节点: ${apiError.message}`,
            );
          }
        }
        if (graphIns.value && currentSelectTreeNode.value?.id === node.id)
          graphIns.value.clear();
        // 在 removeNodeById 之前收集，因为删除后节点树中不再存在这些子节点。
        // syncAllFromDbTree 在删除后执行时，会发现这些表不存在于 dbTree 中，从而清空关联节点配置。
        const collectDescendantTableIds = (children) => {
          const ids = [];
          for (const child of children || []) {
            if (child.type === NODE_TYPES.TABLE) ids.push(child.id);
            ids.push(...collectDescendantTableIds(child.children));
          }
          return ids;
        };
        syncTableIds = collectDescendantTableIds(node.children);
        success = true;
      } else if (node.type === NODE_TYPES.TABLE) {
        const dbNode = findNearestParentByType(node, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行表删除");
        await api.delete(`/api/db/table`, {
          data: {
            serverDbId: dbNode.id,
            name: node.name,
            projectId,
          },
        });
        if (graphIns.value) getGraphEditor().removeNode(node.id);
        syncTableIds = [node.id];
        success = true;
      } else if (node.type === NODE_TYPES.FIELD) {
        const tableNode = findNearestParentByType(node, NODE_TYPES.TABLE);
        if (!tableNode) throw new Error("未找到表节点进行字段删除");
        const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行字段删除");
        await api.delete(`/api/db/field`, {
          data: {
            serverDbId: dbNode.id,
            tableName: tableNode.name,
            fieldName: node.name,
            projectId,
          },
        });
        if (graphIns.value) {
          const graphNode = graphIns.value.getNodeById(tableNode.id);
          if (graphNode) {
            const slotIndex = graphNode.findInputSlot(node.name);
            if (slotIndex !== -1) {
              graphNode.removeInput(slotIndex);
              if (graphNode.outputs.length > slotIndex)
                graphNode.removeOutput(slotIndex);
            }
          }
        }
        syncTableIds = [tableNode.id];
        success = true;
      } else if (node.type === NODE_TYPES.COMPUTED) {
        const tableNode = findNearestParentByType(node, NODE_TYPES.TABLE);
        if (!tableNode) throw new Error("未找到表节点进行列计算删除");
        const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行列计算删除");
        // 生成列 DROP COLUMN 与普通字段一致,复用字段删除接口
        await api.delete(`/api/db/field`, {
          data: {
            serverDbId: dbNode.id,
            tableName: tableNode.name,
            fieldName: node.name,
            projectId,
          },
        });
        syncTableIds = [tableNode.id];
        success = true;
      } else if (node.type === NODE_TYPES.FOLDER) {
        success = true;
      } else if (node.type === NODE_TYPES.VIEW || node.type === NODE_TYPES.MATERIALIZED_VIEW) {
        const dbNode = findNearestParentByType(node, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行视图删除");
        await api.delete(`/api/db/view`, {
          data: {
            serverDbId: dbNode.id,
            name: node.name,
            type: node.type === NODE_TYPES.MATERIALIZED_VIEW ? "materialized" : "view",
            projectId,
          },
        });
        success = true;
      } else if (node.type === NODE_TYPES.PROCEDURE || node.type === NODE_TYPES.FUNCTION) {
        const dbNode = findNearestParentByType(node, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行存储过程删除");
        await api.delete(`/api/db/procedure`, {
          data: {
            serverDbId: dbNode.id,
            name: node.name,
            type: node.type === NODE_TYPES.PROCEDURE ? "procedure" : "function",
            projectId,
          },
        });
        success = true;
      } else if (node.type === NODE_TYPES.SCHEDULED_TASK) {
        const dbNode = findNearestParentByType(node, NODE_TYPES.DATABASE);
        if (dbNode) {
          try {
            await api.delete(`/api/db/scheduled-task/schedule`, {
              data: { serverDbId: dbNode.id, nodeId: node.id, projectId },
            });
          } catch (apiError) {
            console.warn(`取消定时任务调度失败,仅删除本地节点: ${apiError.message}`);
          }
        }
        success = true;
      } else if (node.type === NODE_TYPES.REDIS || node.type === NODE_TYPES.REDIS_DB) {
        success = true;
      }

      if (success) {
        // 收集所有子节点 ID（递归），清理 editors
        const collectAllIds = (n) => {
          const ids = [n.id];
          for (const child of n.children || []) ids.push(...collectAllIds(child));
          return ids;
        };
        const allNodeIds = collectAllIds(node);
        for (const id of allNodeIds) {
          projectStore.removeDbEditorData(id);
        }

        removeNodeById(treeNodes.value, nodeId);
        _saveTreeDataImpl();
        Notify.create({
          type: "positive",
          position: "top",
          message: `'${node.name}' 删除成功`,
        });
        return true;
      }
    } catch (error) {
      console.error(`删除节点 '${node.name}' 失败 (API):`, error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `删除 '${node.name}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return false;
    }
    return false;
  };

  // 修改节点名称
  const updateNodeName = async (nodeId, newName) => {
    const node = findNode(nodeId);
    if (!node || node.name === newName) return false;

    const oldName = node.name;
    let success = false;

    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;

    try {
      // 同步树数据到后端，确保 API 调用时后端拿到最新的 graphData
      await _saveTreeDataImpl();

      if (node.type === NODE_TYPES.DATABASE) {
        const graphData = projectStore.getDbEditorData(node.id, 'graphData');
        const connectionConfig = graphData?.extra?.connection;
        const hasCompleteConfig =
          connectionConfig?.host &&
          connectionConfig?.database &&
          connectionConfig?.user;

        if (hasCompleteConfig) {
          try {
            await api.put(`/api/db/dbbase`, {
              serverDbId: node.id,
              oldDbName: connectionConfig.database,
              newDbName: newName,
              projectId,
            });
          } catch (apiError) {
            console.warn(
              `重命名远程数据库失败，将只更新本地节点: ${apiError.message}`,
            );
          }
        }
        const gd = projectStore.getDbEditorData(node.id, 'graphData');
        if (gd?.extra?.connection) {
          gd.extra.connection.database = newName;
          projectStore.updateDbEditorData(node.id, 'graphData', gd);
        }
        getDbConfig().updateConfig("connection.database", newName);
        success = true;
      } else if (node.type === NODE_TYPES.TABLE) {
        const dbNode = findNearestParentByType(node, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行表重命名");
        await api.put(`/api/db/table`, {
          serverDbId: dbNode.id,
          oldName: oldName,
          newName: newName,
          projectId,
        });
        getGraphEditor().updateNodeTitle(nodeId, newName);
        success = true;
      } else if (node.type === NODE_TYPES.FIELD) {
        const tableNode = findNearestParentByType(node, NODE_TYPES.TABLE);
        if (!tableNode) throw new Error("未找到表节点进行字段重命名");
        const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行字段重命名");
        await api.put(`/api/db/field`, {
          serverDbId: dbNode.id,
          tableName: tableNode.name,
          oldFieldName: oldName,
          newFieldName: newName,
          projectId,
        });
        if (graphIns.value && tableNode) {
          getGraphEditor().updateSlotName(tableNode.id, oldName, newName);
        }
        success = true;
      } else if (node.type === NODE_TYPES.COMPUTED) {
        const tableNode = findNearestParentByType(node, NODE_TYPES.TABLE);
        if (!tableNode) throw new Error("未找到表节点进行列计算重命名");
        const dbNode = findNearestParentByType(tableNode, NODE_TYPES.DATABASE);
        if (!dbNode) throw new Error("未找到数据库节点进行列计算重命名");
        // 生成列 RENAME COLUMN 与普通字段一致,复用字段重命名接口
        await api.put(`/api/db/field`, {
          serverDbId: dbNode.id,
          tableName: tableNode.name,
          oldFieldName: oldName,
          newFieldName: newName,
          projectId,
        });
        success = true;
      } else if (node.type === NODE_TYPES.FOLDER) {
        success = true;
      } else if (node.type === NODE_TYPES.SCHEDULED_TASK) {
        success = true;
      } else if (node.type === NODE_TYPES.REDIS) {
        success = true;
      }

      if (success) {
        node.name = newName;
        node.label = newName;
        Notify.create({
          type: "positive",
          position: "top",
          message: `'${oldName}' 重命名为 '${newName}' 成功`,
        });
        return true;
      }
    } catch (error) {
      console.error(`重命名节点 '${oldName}' 失败 (API):`, error);
      Notify.create({
        type: "negative",
        position: "top",
        message: `重命名 '${oldName}' 为 '${newName}' 失败: ${error.response?.data?.message || error.message}`,
      });
      return false;
    }
    return false;
  };

  // 选择节点
  const selectNode = (node) => {
    if (!node) return false;
    selectedId.value = node.id;
    getDbConfig().selectNode(node);
    return true;
  };

  // 获取节点可执行的操作
  const getNodeOperations = (node) => {
    if (!node) return {};

    const operations = {
      canAddFolder: false,
      canAddDatabase: false,
      canAddRedis: false,
      canAddTable: false,
      canAddField: false,
      canAddView: false,
      canAddFunction: false,
      canAddProcedure: false,
      canAddComputed: false,
      canAddScheduledTask: false,
      canAddKey: false,
      canRename: node.id !== NODE_TYPES.ROOT && !node.system,
      canDelete: node.id !== NODE_TYPES.ROOT && !node.system,
    };

    if (node.type === NODE_TYPES.ROOT) {
      operations.canAddFolder = true;
      operations.canAddDatabase = true;
      operations.canAddRedis = true;
      return operations;
    }

    if (node.type === NODE_TYPES.REDIS) {
      return operations;
    }

    if (node.type === NODE_TYPES.REDIS_DB) {
      operations.canAddKey = true;
      operations.canRename = false;
      operations.canDelete = false;
      return operations;
    }

    if (node.type === NODE_TYPES.DATABASE) {
      operations.canAddFolder = true;
      operations.canAddTable = true;
      operations.canAddView = true;
      operations.canAddFunction = true;
      operations.canAddProcedure = true;
      operations.canAddScheduledTask = true;
      return operations;
    }

    if (node.type === NODE_TYPES.FUNCTION_ROOT) {
      operations.canAddFunction = true;
      operations.canRename = false;
      operations.canDelete = false;
      return operations;
    }

    if (node.type === NODE_TYPES.PROCEDURE_ROOT) {
      operations.canAddProcedure = true;
      operations.canRename = false;
      operations.canDelete = false;
      return operations;
    }

    if (node.type === NODE_TYPES.SCHEDULED_TASK_ROOT) {
      operations.canAddScheduledTask = true;
      operations.canRename = false;
      operations.canDelete = false;
      return operations;
    }

    if (node.type === NODE_TYPES.TABLE) {
      operations.canAddFolder = true;
      operations.canAddField = true;
      operations.canAddComputed = true;
      operations.canAddView = true;
      return operations;
    }

    if (node.type === NODE_TYPES.VIEW || node.type === NODE_TYPES.MATERIALIZED_VIEW) {
      return operations;
    }

    if (node.type === NODE_TYPES.PROCEDURE || node.type === NODE_TYPES.FUNCTION) {
      return operations;
    }

    // 处理目录节点 - 使用 getNodePath 向上查找父级节点类型
    if (node.type === NODE_TYPES.FOLDER) {
      const path = getNodePath(treeNodes.value, node.id);
      let parentType = null;

      // 从当前节点向上（排除自身）查找最近的非 FOLDER 父节点
      for (let i = path.length - 2; i >= 0; i--) {
        if (path[i].type !== NODE_TYPES.FOLDER) {
          parentType = path[i].type;
          break;
        }
      }

      if (!parentType || parentType === NODE_TYPES.ROOT) {
        operations.canAddFolder = true;
        operations.canAddDatabase = true;
      } else if (parentType === NODE_TYPES.DATABASE) {
        operations.canAddFolder = true;
        operations.canAddTable = true;
        operations.canAddView = true;
        operations.canAddFunction = true;
        operations.canAddProcedure = true;
        operations.canAddScheduledTask = true;
      } else if (parentType === NODE_TYPES.TABLE) {
        operations.canAddFolder = true;
        operations.canAddField = true;
        operations.canAddComputed = true;
        operations.canAddView = true;
      }

      return operations;
    }

    return operations;
  };

  // 为表创建图形节点
  function createGraphNodeForTable(tableId, tableName, partitioned = false) {
    const canvasWidth = canvasIns.value?.canvas.width || 1000;
    const canvasHeight = canvasIns.value?.canvas.height || 600;

    const x = Math.random() * (canvasWidth - 200) + 100;
    const y = Math.random() * (canvasHeight - 200) + 100;

    const node = getGraphEditor().createNode("db/table", [x, y], tableId, tableName);
    if (node) node.properties.partitioned = partitioned;
  }

  // 从 currentProject.database.dbTree 获取树数据
  const fetchTreeData = async () => {
    try {
      isLoading.value = true;
      Notify.create({
        type: "info",
        message: "正在获取数据库树...",
        position: "top",
        timeout: 1000,
      });

      const projectStore = useProjectStore();
      const dbTree = projectStore.currentProject?.database?.dbTree;

      if (dbTree && Array.isArray(dbTree)) {
        return dbTree;
      } else {
        return [];
      }
    } catch (error) {
      console.error("获取树数据错误:", error);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // 同步部分：更新 Pinia store（保证前端数据一致）
  const _syncTreeToStore = () => {
    if (treeNodes.value.length === 0) {
      console.error("树数据为空，无法保存");
      return false;
    }
    const treeData = nestedToFlat(treeNodes.value, [
      'id', 'pId', 'name', 'type', 'isParent', 'iconSkin', 'open', 'system',
    ]);
    const projectStore = useProjectStore();
    if (projectStore.currentProject?.database) {
      projectStore.currentProject.database.dbTree = treeData;
      return true;
    }
    console.error("无当前项目，无法保存数据");
    return false;
  };

  // 异步部分：持久化到后端（fire-and-forget）
  const _persistTreeToBackend = () => {
    const projectStore = useProjectStore();
    const projectId = projectStore.currentProjectId;
    const treeData = projectStore.currentProject?.database?.dbTree;
    const editors = projectStore.currentProject?.database?.editors;
    if (projectId && treeData) {
      api.post('/api/db-tree', { treeData, editors, projectId }).then(() => {
        // 同步快照的 database 模块，防止自动保存基于旧快照生成 patch
        // 导致 syncModules 对已更新的后端数据重复应用数组操作而破坏数据
        patchModuleSnapshot(projectId, 'database', projectStore.currentProject.database);
      }).catch(err => {
        console.error("持久化 dbTree 失败:", err);
      });
    }
  };

  // 保存树数据到 currentProject.database.dbTree（内部实现）
  // 同步更新 store + 异步持久化到后端（fire-and-forget）
  const _saveTreeDataImpl = async () => {
    if (!_syncTreeToStore()) return false;
    _persistTreeToBackend();
    return true;
  };

  // 保存树数据到后端（防抖版本）
  const saveTreeData = useDebounceFn(_saveTreeDataImpl, 300);

  // 初始化树
  const initTree = async () => {
    try {
      let initialNodes = [];

      const treeData = await fetchTreeData();
      if (treeData && treeData.length > 0) {
        initialNodes = treeData;
      } else {
        initialNodes = [
          {
            id: NODE_TYPES.ROOT,
            pId: null,
            name: "数据库",
            type: NODE_TYPES.ROOT,
            isParent: true,
            open: true,
            iconSkin: "folder",
          },
        ];
        saveTreeData();
      }

      // 一次性迁移：将旧的内嵌 graphData 提取到 editors
      const projectStore = useProjectStore();
      if (!projectStore.currentProject.database.editors) {
        projectStore.currentProject.database.editors = {};
      }
      let migrated = false;
      for (const node of initialNodes) {
        if (node.graphData && Object.keys(node.graphData).length > 0) {
          // 仅在 editors 中没有该节点数据时才迁移，避免旧嵌入数据覆盖已更新的 editors
          if (!projectStore.getDbEditorData(node.id, 'graphData')) {
            projectStore.updateDbEditorData(node.id, 'graphData', node.graphData);
          }
          delete node.graphData;
          migrated = true;
        }
      }

      // 统一转换为 QTree 嵌套格式（兼容旧嵌套数据和新扁平数据）
      treeNodes.value = normalizeTreeData(initialNodes);

      // 迁移：为旧表补充缺失的系统字段树节点
      const migrateSystemFields = (nodes) => {
        for (const node of nodes) {
          if (node.type === NODE_TYPES.TABLE) {
            for (const sf of SYSTEM_FIELDS) {
              // 已有同名子节点则仅补充 system 标记
              const existing = (node.children || []).find(c => c.name === sf.name);
              if (existing) {
                if (!existing.system) { existing.system = true; migrated = true; }
                continue;
              }
              // 缺失则创建
              const fieldId = uid();
              const fieldNode = {
                id: fieldId,
                pId: node.id,
                name: sf.name,
                label: sf.name,
                type: NODE_TYPES.FIELD,
                iconSkin: "field",
                system: true,
                children: [],
              };
              // 系统字段插入到 children 开头
              node.children = node.children || [];
              node.children.unshift(fieldNode);
              migrated = true;
            }
          }
          if (node.children?.length) migrateSystemFields(node.children);
        }
      };
      migrateSystemFields(treeNodes.value);

      const ensureAllDatabaseDefaultRoots = (nodes) => {
        for (const node of nodes) {
          if (node.type === NODE_TYPES.DATABASE) {
            migrated = ensureDatabaseDefaultRoots(node) || migrated;
          }
          if (node.children?.length) ensureAllDatabaseDefaultRoots(node.children);
        }
      };
      ensureAllDatabaseDefaultRoots(treeNodes.value);

      const moveDatabaseOwnedNodesToDefaultRoots = (nodes, activeDbNode = null) => {
        for (const node of nodes) {
          const dbNode = node.type === NODE_TYPES.DATABASE ? node : activeDbNode;
          const targetRootType = {
            [NODE_TYPES.FUNCTION]: NODE_TYPES.FUNCTION_ROOT,
            [NODE_TYPES.PROCEDURE]: NODE_TYPES.PROCEDURE_ROOT,
            [NODE_TYPES.SCHEDULED_TASK]: NODE_TYPES.SCHEDULED_TASK_ROOT,
          }[node.type];
          const targetRootNode = targetRootType ? findDatabaseDefaultRoot(dbNode, targetRootType) : null;
          if (
            dbNode &&
            targetRootNode &&
            node.pId !== targetRootNode.id
          ) {
            removeNodeById(treeNodes.value, node.id);
            node.pId = targetRootNode.id;
            addChildNode(treeNodes.value, targetRootNode.id, node);
            migrated = true;
            continue;
          }
          if (node.children?.length) moveDatabaseOwnedNodesToDefaultRoots([...node.children], dbNode);
        }
      };
      moveDatabaseOwnedNodesToDefaultRoots([...treeNodes.value]);

      // 默认展开第一层
      expandedIds.value = treeNodes.value.map(n => n.id);

      // 迁移后立即保存，确保后端 dbTree 永久移除 graphData
      if (migrated) {
        _saveTreeDataImpl();
      }

      // 恢复选中状态
      const lastSelect = projectStore.getDbCurrentSelect();
      if (lastSelect) {
        const node = findNode(lastSelect);
        if (node) {
          selectedId.value = lastSelect;
        }
      }
    } catch (error) {
      console.error("初始化树失败:", error);
      Notify.create({
        type: "negative",
        message: "初始化树失败: " + error.message,
        position: "top",
      });
    }
  };

  return {
    treeNodes,
    selectedId,
    expandedIds,
    isLoading,
    NODE_TYPES,

    findNode,
    findNearestParentByType,

    getNodeOperations,
    generateName,

    addFolderNode,
    addDatabaseNode,
    addRedisNode,
    addTableNode,
    addFieldNode,
    addComputedColumnNode,
    addViewNode,
    addProcedureNode,
    addScheduledTaskNode,
    removeNode,
    updateNodeName,
    selectNode,

    fetchTreeData,
    saveTreeData,
    initTree,
  };
};
