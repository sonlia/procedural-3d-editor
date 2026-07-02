import { nodeMeta } from "../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { LiteGraph } from "../../editor.js";

/**
 * StoreRef 节点 - 引用 Pinia Store
 * 动态生成 output slots，输出 state、getters、actions
 */
export class StoreRef extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      storeId: null, // 选择的 store ID
      storeName: null, // store 名称（用于显示）
      selectedOutputs: [], // 用户选择的输出成员：[{ id, type, name }]
      actionParams: {}, // action 参数配置：{ actionName: [{ id, name, isSlot, value }] }
      remark: "",
    };

    // 指定属性面板
    this.uiPanel = defineAsyncComponent(() => import("./storeRefPanel.vue"));

    this.color = "#8B5CF6"; // 紫色，与 PiniaStore 一致

  }


  /**
   * 根据 store 元数据和用户选择动态创建 slots
   */
  updateSlots() {
    const storeId = this.properties.storeId;
    if (!storeId || !this.graph) return;

    // 从 graph.extra 读取元数据
    const metadata = this.graph.extra?.pinia?.[storeId];
    if (!metadata) return;

    // 清空旧的 inputs（保留 orderIn）
    const orderIn = this.inputs.find((i) => i.name === "orderIn");
    this.inputs = orderIn ? [orderIn] : [];

    // 清空旧的 outputs（保留 orderOut）
    const orderOut = this.outputs.find((o) => o.name === "orderOut");
    this.outputs = orderOut ? [orderOut] : [];

    const selectedOutputs = this.properties.selectedOutputs || [];

    // 为用户选择的成员创建 output slots
    selectedOutputs.forEach((output) => {
      // 跳过未选择成员的输出项
      if (!output.type || !output.name) return;

      if (output.type === "state") {
        this.addOutput(output.name, "string", {
          id: output.id,
          category: "state",
          shape: 3, // 圆点
          color: "#60A5FA", // 蓝色
          storeMember: { type: "state", name: output.name },
        });
      } else if (output.type === "getter") {
        this.addOutput(output.name, "string", {
          id: output.id,
          category: "getter",
          shape: 3, // 圆点
          color: "#34D399", // 绿色
          storeMember: { type: "getter", name: output.name },
        });
      } else if (output.type === "action") {
        // 为 action 的参数创建 input slots
        const action = metadata.actions?.find((a) => a.name === output.name);
        if (action && action.params && action.params.length > 0) {
          const actionParamConfig = this.properties.actionParams[action.name] || [];

          action.params.forEach((param, idx) => {
            const paramConfig = actionParamConfig[idx];
            // 只有 isSlot 为 true 时才创建 input slot
            if (paramConfig && paramConfig.isSlot) {
              const shape = param.isCallback ? 5 : 3;
              this.addInput(`${action.name}.${param.name}`, "string", {
                id: paramConfig.id,
                category: "action-param",
                shape,
                color: "#F59E0B",
                storeMember: {
                  type: "action-param",
                  actionName: action.name,
                  paramName: param.name,
                  isCallback: param.isCallback,
                },
              });
            }
          });
        }

        // 为 action 创建 output slot
        this.addOutput(output.name, "string", {
          id: output.id,
          category: "action",
          shape: 3, // 圆点
          color: "#F59E0B", // 橙色
          storeMember: {
            type: "action",
            name: output.name,
          },
        });
      }
    });

 
  }

  onExecute() {
    const storeId = this.properties.storeId;
    if (!storeId || !this.graph) return;

    // 从 graph.extra 读取元数据
    const metadata = this.graph.extra?.pinia?.[storeId];
    if (!metadata) return;

    const storeVar = metadata.storeVar;
    const storeName = metadata.name;

    // 生成代码：const store_938eebed = useStore_938eebedStore()
    this.jsCode = `const ${storeName} = ${storeVar}()`;

    const selectedOutputs = this.properties.selectedOutputs || [];

    // 遍历已选择的输出成员，通过 name 查找对应的 output slot
    selectedOutputs.forEach((output) => {
      // 跳过未选择成员的输出项
      if (!output.type || !output.name) return;

      // 通过 output.name 查找对应的 slot 索引（slot.name 与 output.name 相同）
      const slotIndex = this.outputs.findIndex((o) => o.name === output.name);
      if (slotIndex === -1) return;

      // 在 store 外部使用时，Pinia 自动解包 ref，不需要 .value
      this.setOutputData(slotIndex, `${storeName}.${output.name}`);
    });
  }

  static get title() {
    return "StoreRef";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "b2c3d4e5-6f78-9012-bcde-f12345678901";
  }
  static get treePath() {
    return "Pinia";
  }
}
