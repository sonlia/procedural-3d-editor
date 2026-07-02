import { defineAsyncComponent } from "vue";
import { QLayoutNodeMeta, createQLayoutProperties, Q_LAYOUT_NODE_RAW_DATA } from "../../webNode/layout/QLayoutNodeMeta.js";

export class QLayoutTools extends QLayoutNodeMeta {
  constructor() {
    super();
    this.tag = "QLayout";
    this.nodeRawData = Q_LAYOUT_NODE_RAW_DATA;
    this.docs = Q_LAYOUT_NODE_RAW_DATA.meta.docs;
    this.categories = "ui";
    this.importStr = Q_LAYOUT_NODE_RAW_DATA.importStr;
    this.parentMustBe = [];
    this.properties = createQLayoutProperties();
    this.uiPanel = defineAsyncComponent(() => import("./QLayoutPanel.vue"));
  }

  static get title() {
    return "QLayoutTools";
  }

  static get name() {
    return "QLayoutTools";
  }

  static get treePath() {
    return "ui/quasar";
  }

  static get id() {
    return "33571611-99B4-6CD2-8F7C-D4553E6BBC20";
  }
}
