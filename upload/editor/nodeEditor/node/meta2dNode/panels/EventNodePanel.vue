<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">事件节点</div>

    <!-- 触发类型 -->
    <div class="form-row">
      <span class="form-label">触发类型</span>
      <q-select
        v-model="model.properties.trigger"
        dark
        dense
        outlined
        :options="triggerOpts"
        emit-value
        map-options
        class="col"
      />
    </div>

    <!-- 行为类型 -->
    <div class="form-row">
      <span class="form-label">行为类型</span>
      <q-select
        v-model="model.properties.behavior"
        dark
        dense
        outlined
        :options="behaviorOpts"
        emit-value
        map-options
        class="col"
      />
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- ============ 行为参数区 ============ -->

    <!-- link: URL + 打开方式 -->
    <template v-if="model.properties.behavior === 'link'">
      <div class="form-row">
        <span class="form-label">链接地址</span>
        <q-input
          v-model="model.properties.url"
          dark
          dense
          outlined
          placeholder="https://..."
          class="col"
        />
      </div>
      <div class="form-row">
        <span class="form-label">打开方式</span>
        <q-select
          v-model="model.properties.target"
          dark
          dense
          outlined
          :options="linkTargetOpts"
          emit-value
          map-options
          class="col"
        />
      </div>
    </template>

    <!-- setValue: 目标图元 + 属性 JSON -->
    <template v-else-if="model.properties.behavior === 'setValue'">
      <div class="form-row">
        <span class="form-label">目标 id/tag</span>
        <q-input
          v-model="model.properties.targetId"
          dark
          dense
          outlined
          placeholder="留空表示当前图元"
          class="col"
        />
      </div>
      <div class="text-grey-6 text-caption q-mb-xs">属性对象 (JSON)</div>
      <q-input
        v-model="model.properties.propsJson"
        dark
        dense
        outlined
        type="textarea"
        rows="3"
        placeholder='{"color": "#ff0000"}'
      />
    </template>

    <!-- javascript: 代码输入 -->
    <template v-else-if="model.properties.behavior === 'javascript'">
      <div class="text-grey-6 text-caption q-mb-xs">JS 代码</div>
      <q-input
        v-model="model.properties.jsCode"
        dark
        dense
        outlined
        type="textarea"
        rows="4"
        placeholder="// pen, params, context 可用"
        input-style="font-family: monospace"
      />
    </template>

    <!-- globalFn: 函数名 -->
    <template v-else-if="model.properties.behavior === 'globalFn'">
      <div class="form-row">
        <span class="form-label">函数名</span>
        <q-input
          v-model="model.properties.fnName"
          dark
          dense
          outlined
          placeholder="functionName"
          class="col"
        />
      </div>
    </template>

    <!-- emit: 消息名 -->
    <template v-else-if="model.properties.behavior === 'emit'">
      <div class="form-row">
        <span class="form-label">消息名</span>
        <q-input
          v-model="model.properties.messageName"
          dark
          dense
          outlined
          placeholder="messageName"
          class="col"
        />
      </div>
    </template>

    <!-- 动画/视频控制: 目标 tag -->
    <template
      v-else-if="
        [
          'startAnimate', 'pauseAnimate', 'stopAnimate',
          'startVideo', 'pauseVideo', 'stopVideo',
        ].includes(model.properties.behavior)
      "
    >
      <div class="form-row">
        <span class="form-label">目标 tag</span>
        <q-input
          v-model="model.properties.targetTag"
          dark
          dense
          outlined
          placeholder="留空表示当前图元"
          class="col"
        />
      </div>
    </template>

    <!-- ============ 触发条件区（可折叠） ============ -->
    <q-expansion-item
      dense
      dark
      label="触发条件"
      icon="filter_alt"
      header-class="text-grey-5"
    >
      <div class="q-pa-xs">
        <div class="form-row">
          <span class="form-label">类型</span>
          <q-input
            v-model="model.properties.whereType"
            dark
            dense
            outlined
            placeholder="可选"
            class="col"
          />
        </div>
        <div class="text-grey-6 text-caption q-mb-xs">条件代码 (返回 true/false)</div>
        <q-input
          v-model="model.properties.whereFnJs"
          dark
          dense
          outlined
          type="textarea"
          rows="3"
          placeholder='return pen.id === "xxx"'
          input-style="font-family: monospace"
        />
      </div>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";
import {
  triggerTypes,
  behaviorTypes,
} from "../../../../meta2dEditor/data/nodeDefinitions.js";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

const triggerOpts = triggerTypes;
const behaviorOpts = behaviorTypes;

const linkTargetOpts = [
  { label: "新窗口", value: "_blank" },
  { label: "当前窗口", value: "_self" },
];
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.form-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}
</style>
