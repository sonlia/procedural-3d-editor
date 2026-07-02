import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseLocalStorage extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `storage_${uid().slice(0, 8)}` },

      // Hook 参数
      key: { id: uid(), isSlot: false, value: "" },
      initialValue: { id: uid(), isSlot: false, value: "" },

      // 选项
      listenToStorageChanges: true,
      writeDefaults: true,
      mergeDefaults: false,
      shallow: false,
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./storagePanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `storage_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `storage_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取参数
    const key = getParamValue(props.key);
    const initialValue = getParamValue(props.initialValue);

    if (!key) {
      this.jsCode = `// useLocalStorage: key is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (!props.listenToStorageChanges) options.push("listenToStorageChanges: false");
    if (!props.writeDefaults) options.push("writeDefaults: false");
    if (props.mergeDefaults) options.push("mergeDefaults: true");
    if (props.shallow) options.push("shallow: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";
    const initialValueStr = initialValue ? `, ${initialValue}` : "";

    // 生成代码
    this.importStr = `import { useLocalStorage } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = useLocalStorage(${key}${initialValueStr}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-uselocalstorage-a1b2c3d4-e5f6-7890-abcd-ef1234567890"; }
  static get title() { return "useLocalStorage"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Storage"; }
}
