import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineConsole extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      useSlot: false,
      consoleValue: "",
      consoleMethod: "log",
      remark: "",
    };
    this.uiPanel = defineAsyncComponent(() => import("./consolePanel.vue"));
  }

  onExecute() {
    const { useSlot, consoleValue, consoleMethod, id } = this.properties;
    const method = consoleMethod || "log";

    let value;
    if (useSlot) {
      const idx = this.inputs.findIndex((s) => s.id === id);
      value =
        idx !== -1 && this.isInputConnected(idx)
          ? this.getInputData(idx)
          : "undefined";
    } else {
      value = consoleValue || "undefined";
    }

    this.jsCode = `console.${method}(${value});`;
  }

  static get title() {
    return "console";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "a91cf4d2-481b-4eeb-8275-9c4f13a30b11";
  }

  static get treePath() {
    return "JavaScript";
  }
}
