import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

// ================= Continue Node =================
export class defineContinue extends nodeMeta {
  constructor() {
    super();
    this.properties = {
      remark: "",
    };
    this.uiPanel = defineAsyncComponent(() => import("./continuePanel.vue"));
  }

  onExecute() {
    this.jsCode = "continue;";
  }

  static get title() {
    return "Continue";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "e1b2c3d4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";
  }
  static get treePath() {
    return "JavaScript/control";
  }
}
