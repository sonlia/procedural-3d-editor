import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Return Node =================
export class defineReturn extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      useSlot: false,
      returnValue: "",
      remark: "",
    };
    this.uiPanel = defineAsyncComponent(() => import("./returnPanel.vue"));
  }

  onExecute() {
    const { useSlot, returnValue, id } = this.properties;

    if (useSlot) {
      const idx = this.inputs.findIndex((s) => s.id === id);
      if (idx !== -1 && this.isInputConnected(idx)) {
        const value = this.getInputData(idx);
        this.jsCode = `return ${value};`;
      } else {
        this.jsCode = "return;";
      }
    } else {
      this.jsCode = `return ${returnValue || "undefined"};`;
    }
  }

  static get title() {
    return "Return";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "d2c3d4e5-a6b7-4c8d-9e0f-1a2b3c4d5e6f";
  }
  static get treePath() {
    return "JavaScript/control";
  }
}
