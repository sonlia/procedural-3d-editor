<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm column q-gutter-y-md">
      <q-input
        v-model="cfg.nodeTitle"
        dark
        dense
        outlined
        label="节点名称(在 graph 搜索框显示)"
      />

      <!-- 后端接口:导出节点据此 fetch 调用(须与生成的 routeCode 注册路径一致)-->
      <div class="row items-center q-gutter-x-sm no-wrap">
        <q-input
          v-model="cfg.apiPath"
          dark
          dense
          outlined
          class="col"
          label="后端接口路径(如 /api/users)"
        />
        <q-select
          v-model="cfg.method"
          :options="HTTP_METHODS"
          dark
          dense
          outlined
          class="method-sel"
          label="方法"
        />
      </div>

      <!-- 输入 slot(in)-->
      <div>
        <div class="row items-center q-mb-xs">
          <q-icon name="login" size="sm" color="green" />
          <span class="q-ml-xs text-grey-4">输入 slot(in · 入参)</span>
          <q-space />
          <q-btn dark dense flat size="sm" icon="add" @click="add('in')">
            <q-tooltip>加一个入参</q-tooltip>
          </q-btn>
        </div>
        <div
          v-for="(s, i) in cfg.inputs"
          :key="'in' + i"
          class="row items-center q-gutter-x-xs q-mb-xs no-wrap"
        >
          <q-input v-model="s.name" dark dense outlined class="col" label="名称" />
          <q-select
            v-model="s.type"
            :options="SLOT_TYPES"
            dark
            dense
            outlined
            emit-value
            map-options
            class="slot-type"
            label="类型"
          />
          <q-btn dark dense flat size="sm" icon="close" color="grey-6" @click="remove('in', i)" />
        </div>
      </div>

      <!-- 输出 slot(out)-->
      <div>
        <div class="row items-center q-mb-xs">
          <q-icon name="logout" size="sm" color="orange" />
          <span class="q-ml-xs text-grey-4">输出 slot(out · 出参/返回)</span>
          <q-space />
          <q-btn dark dense flat size="sm" icon="add" @click="add('out')">
            <q-tooltip>加一个出参</q-tooltip>
          </q-btn>
        </div>
        <div
          v-for="(s, i) in cfg.outputs"
          :key="'out' + i"
          class="row items-center q-gutter-x-xs q-mb-xs no-wrap"
        >
          <q-input v-model="s.name" dark dense outlined class="col" label="名称" />
          <q-select
            v-model="s.type"
            :options="SLOT_TYPES"
            dark
            dense
            outlined
            emit-value
            map-options
            class="slot-type"
            label="类型"
          />
          <q-btn dark dense flat size="sm" icon="close" color="grey-6" @click="remove('out', i)" />
        </div>
      </div>
    </div>
  </q-scroll-area>
</template>

<script setup>
// 导出契约子编辑器:就地改 aiEditor.exported(用 defineModel("cfg") 过 no-mutating-props,
// 只改成员、不重新赋值 cfg.value)。slot 类型收敛为 string / function(见 core-design §4.3)。
const cfg = defineModel("cfg", { required: true });

const SLOT_TYPES = [
  { label: "string(变量名/表达式)", value: "string" },
  { label: "function(函数引用)", value: "function" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

const add = (dir) => {
  const list = dir === "in" ? cfg.value.inputs : cfg.value.outputs;
  list.push({ name: "", type: "string", desc: "" });
};

const remove = (dir, i) => {
  const list = dir === "in" ? cfg.value.inputs : cfg.value.outputs;
  list.splice(i, 1);
};
</script>

<style scoped>
.slot-type {
  width: 200px;
}
.method-sel {
  width: 110px;
}
</style>
