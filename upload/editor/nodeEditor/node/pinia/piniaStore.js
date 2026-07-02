import { Subgraph } from "../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { defineVueReactivity, defineVueComputed } from "../vue/base.js";
import { FunctionBlock } from "../logicNode/jsBase/functionBlock.js";

/**
 * PiniaStore 节点 - 定义 Pinia Store
 * 继承 Subgraph，包含内部子图用于定义 state、getters、actions
 */
export class PiniaStore extends Subgraph {
  constructor() {
    super();

    const defaultName = `store_${uid().slice(0, 8)}`;

    this.properties = {
      // 基础控制
      exported: true, // 默认导出
      name: defaultName, // store 名称，用户输入

      // 收集到的子图节点信息（在 onExecute 中更新）
      collectedNodes: {
        state: [],    // [{ id, name, expose }]
        getters: [],  // [{ id, name, expose }]
        actions: [],  // [{ id, name, params, expose }]
      },

      remark: "",
    };

    // 指定属性面板
    this.uiPanel = defineAsyncComponent(
      () => import("./piniaStorePanel.vue"),
    );

    this.color = "#8B5CF6"; // 紫色区分

    // 绑定子图事件监听
    this.setupSubgraphListeners();
  }

  /**
   * 设置子图事件监听
   */
  setupSubgraphListeners() {
    if (!this.subgraph) return;

    // 监听节点添加
    const originalOnNodeAdded = this.subgraph.onNodeAdded;
    this.subgraph.onNodeAdded = (node) => {
      if (originalOnNodeAdded) {
        originalOnNodeAdded.call(this.subgraph, node);
      }
      this.updateCollectedNodes();
      this.updateGraphExtra();
    };

    // 监听节点移除
    const originalOnNodeRemoved = this.subgraph.onNodeRemoved;
    this.subgraph.onNodeRemoved = (node) => {
      if (originalOnNodeRemoved) {
        originalOnNodeRemoved.call(this.subgraph, node);
      }
      this.updateCollectedNodes();
      this.updateGraphExtra();
    };

    // 监听连接变化（特别是 FunctionBlock 的 funcOut）
    const originalOnConnectionChange = this.subgraph.onConnectionChange;
    this.subgraph.onConnectionChange = (node) => {
      if (originalOnConnectionChange) {
        originalOnConnectionChange.call(this.subgraph, node);
      }
      this.updateCollectedNodes();
      this.updateGraphExtra();
    };
  }

  /**
   * 自动生成 storeVar
   * 规则: use + capitalize(name) + Store
   */
  get storeVar() {
    const name = this.properties.name || "store";
    return `use${name.charAt(0).toUpperCase() + name.slice(1)}Store`;
  }

  /**
   * 收集子图内的变量/计算/方法元数据
   */
  collectMetadata() {
    const metadata = {
      id: this.id,
      name: this.properties.name,
      storeVar: this.storeVar,
      state: [],
      getters: [],
      actions: [],
    };

    if (!this.subgraph || !this.subgraph._nodes) {
      return metadata;
    }

    this.subgraph._nodes.forEach((node) => {
      // defineVueReactivity 节点 → state
      if (node instanceof defineVueReactivity) {
        const items = node.properties?.reactivityItems || [];
        items.forEach((item) => {
          const varName = item.varName?.value || item.varName;
          const expose = item.expose ?? true;

          if (varName) {
            metadata.state.push({
              name: varName,
              expose,
              nodeId: node.id,
            });
          }
        });
      }

      // defineVueComputed 节点 → getters
      if (node instanceof defineVueComputed) {
        const varName = node.properties?.outputVar?.value;
        const expose = node.properties?.expose ?? true;

        if (varName) {
          metadata.getters.push({
            name: varName,
            expose,
            nodeId: node.id,
          });
        }
      }

      // FunctionBlock 节点 → actions
      if (node instanceof FunctionBlock) {
        const funcName = node.properties?.functionName;
        const expose = node.properties?.expose ?? true;

        // 检查 funcOut 是否有连接
        const funcOutSlot = node.outputs?.find((o) => o.name === "funcOut");
        const hasFuncOutConnection = funcOutSlot && funcOutSlot.links && funcOutSlot.links.length > 0;

        // 只有当 funcOut 没有连接时，才作为 action 导出
        // funcOut 有连接说明是匿名函数/回调函数，不应该导出
        if (funcName && !hasFuncOutConnection) {
          // 从 properties.params 读取所有参数
          const params = (node.properties?.params || []).map((p) => ({
            name: p.name,
            isCallback: p.isCallback || false,
          }));

          metadata.actions.push({
            name: funcName,
            expose,
            params,
            nodeId: node.id,
          });
        }
      }
    });

    return metadata;
  }

  /**
   * 收集子图内节点信息到 properties.collectedNodes
   * 供面板实时显示使用
   */
  updateCollectedNodes() {
    const collected = {
      state: [],
      getters: [],
      actions: [],
    };

    if (!this.subgraph || !this.subgraph._nodes) {
      this.properties.collectedNodes = collected;
      return;
    }

    this.subgraph._nodes.forEach((node) => {
      // defineVueReactivity 节点 → state
      if (node instanceof defineVueReactivity) {
        const items = node.properties?.reactivityItems || [];
        items.forEach((item) => {
          const varName = item.varName?.value || item.varName;
          const expose = item.expose ?? true;

          if (varName) {
            collected.state.push({
              id: `${node.id}_${item.id}`,
              name: varName,
              expose,
            });
          }
        });
      }

      // defineVueComputed 节点 → getters
      if (node instanceof defineVueComputed) {
        const varName = node.properties?.outputVar?.value;
        const expose = node.properties?.expose ?? true;

        if (varName) {
          collected.getters.push({
            id: node.id,
            name: varName,
            expose,
          });
        }
      }

      // FunctionBlock 节点 → actions
      if (node instanceof FunctionBlock) {
        const funcName = node.properties?.functionName;
        const expose = node.properties?.expose ?? true;
        const funcOutSlot = node.outputs?.find((o) => o.name === "funcOut");
        const hasFuncOutConnection = funcOutSlot && funcOutSlot.links && funcOutSlot.links.length > 0;

        if (funcName && !hasFuncOutConnection) {
          const params = (node.properties?.params || []).map((p) => p.name);
          const paramStr = params.length > 0 ? `(${params.join(", ")})` : "()";

          collected.actions.push({
            id: node.id,
            name: funcName,
            params: paramStr,
            expose,
          });
        }
      }
    });

    this.properties.collectedNodes = collected;

    // 触发 graph 重绘，确保面板更新
    if (this.graph && this.graph.setDirtyCanvas) {
      this.graph.setDirtyCanvas(true, true);
    }
  }

  /**
   * 更新到 graph.extra.pinia
   */
  updateGraphExtra() {
    const metadata = this.collectMetadata();
    const graph = this.graph;

    if (!graph) return;

    if (!graph.extra) graph.extra = {};
    if (!graph.extra.pinia) graph.extra.pinia = {};

    // 存储 store 元数据
    graph.extra.pinia[this.id] = metadata;

    // 触发全局更新事件（让菜单/其他节点感知）
    if (graph.trigger) {
      graph.trigger("piniaStoreUpdated", metadata);
    }
  }

  onExecute() {
    // 必须调用 super.onExecute() 传递数据给子图
    super.onExecute();

    // 更新收集的节点信息到 properties（供面板显示）
    this.updateCollectedNodes();

    // 更新元数据到 graph.extra
    this.updateGraphExtra();

    const metadata = this.collectMetadata();
    const { exported, name } = this.properties;
    const storeVar = this.storeVar;

    // 生成 return 语句（只包含 expose: true 的成员）
    const returnVars = [
      ...metadata.state.filter((s) => s.expose).map((s) => s.name),
      ...metadata.getters.filter((g) => g.expose).map((g) => g.name),
      ...metadata.actions.filter((a) => a.expose).map((a) => a.name),
    ];

    const exportStr = exported ? "export " : "";
    const remark = this.properties.remark
      ? `/* ${this.properties.remark} */\n`
      : "";

    // 使用 __SUBGRAPH__ 占位符，代码组装器会替换为子图代码
    this.jsCode = `${remark}${exportStr}const ${storeVar} = defineStore('${name}', () => {
__SUBGRAPH_${this.id}__
  return { ${returnVars.join(", ")} }
})`;
  }

  static get title() {
    return "PiniaStore";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a1b2c3d4-5e6f-7890-abcd-ef1234567890";
  }
  static get treePath() {
    return "Pinia";
  }
}
