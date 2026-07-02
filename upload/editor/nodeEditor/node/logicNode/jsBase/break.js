import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

// ================= Break Node =================
export class defineBreak extends nodeMeta {
  constructor() {
    super();
    this.properties = {
      remark: "",
    };
    this.uiPanel = defineAsyncComponent(() => import("./breakPanel.vue"));
  }

  onExecute() {
    this.jsCode = "break;";
  }

  static get title() {
    return "Break";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "f0a1b2c3-d4e5-4f6a-b7c8-d9e0f1a2b3c4";
  }
  static get treePath() {
    return "JavaScript/control";
  }
}
