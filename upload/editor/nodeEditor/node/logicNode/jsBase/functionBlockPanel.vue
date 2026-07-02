<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { set } from 'lodash-es';
import { uid } from 'quasar';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// === 单一数据源模式 ===
// 直接从节点实例获取 properties，构造函数已保证完整初始化
const properties = computed(() => props.value?.properties || {});

// funcOut 连接状态
const isFuncOutConnected = ref(false);

// === 连接变化处理函数 ===
function handleConnectionChange(n) {

  // 过滤：只处理本节点的连接变化
  if (n && n.id === props.value?.id) {
    // 检查是否是 funcOut slot 的连接
    const funcOutIndex = props.value.findOutputSlot("funcOut");
    if (funcOutIndex !== -1) {
      const isConnected = props.value.isOutputConnected(funcOutIndex);
      // 强制转换为布尔值，因为 isOutputConnected 可能返回数字
      isFuncOutConnected.value = Boolean(isConnected);
    }
  }
}

// === 声明状态监听：添加/移除 funcNameInput ===
watch(() => properties.value.enableDeclaration, (newVal) => {
  const funcNameInputId = 'funcNameInput';
  const existingIndex = props.value.inputs.findIndex(i => i.id === funcNameInputId);

  if (newVal) {
    // 声明为 true 时，添加 funcNameInput 输入节点
    if (existingIndex === -1) {
      props.value.addInput('funcNameInput', 'string', { id: funcNameInputId, hideOnNode: false });
    }
  } else {
    // 声明为 false 时，移除 funcNameInput 输入节点
    if (existingIndex !== -1) {
      props.value.removeInput(existingIndex);
    }
  }
  // 触发代码重新生成
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}, { immediate: true }); // immediate 确保组件挂载时也执行

// 计算属性：当声明为 true 时，禁用函数名输入框
const shouldDisableFunctionNameInput = computed(() => {
  return properties.value.enableDeclaration === true;
});

// === 生命周期钩子 ===
onMounted(() => {
  // 挂载时绑定连接变化监听
  if (props.value?.graph) {
    props.value.graph.onConnectionChange = handleConnectionChange;

    // 初始化 funcOut 连接状态
    const funcOutIndex = props.value.findOutputSlot("funcOut");
    if (funcOutIndex !== -1) {
      // 同样强制转换为布尔值
      isFuncOutConnected.value = Boolean(props.value.isOutputConnected(funcOutIndex));
    }
  }
});
onUnmounted(() => {
  // 卸载时移除绑定
  if (props.value?.graph && props.value.graph.onConnectionChange === handleConnectionChange) {
    props.value.graph.onConnectionChange = null;
  }
});

// === 统一更新函数 ===
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 专门处理函数名更新的函数
function updateFunctionName(newName) {
  set(properties.value, 'functionName', newName);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function addParam() {
  const newParam = {
    id: uid(),
    name: `arg${properties.value.params.length}`,
    hideOnNode: true,  // 默认 slot 为 false
    isCallback: false
  };

  properties.value.params.push(newParam);

  // 添加参数时，默认隐藏 slot（hideOnNode: true）
  // 普通参数 valueMode='label':子图内 GraphInput 拿到参数名字符串作为变量名引用
  props.value.addInput(newParam.name, 'string', { id: newParam.id, hideOnNode: true, valueMode: 'label' });
}

function removeParam(paramId, index) {
  const existingInputIndex = props.value.inputs.findIndex(i => i.id === paramId);
  if (existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
    properties.value.params.splice(index, 1);
  }
}

// 更新参数的 slot 状态（显示/隐藏）
function updateParamSlot(param, isSlotActive) {
  if (!param) {
    console.error('updateParamSlot: param is undefined');
    return;
  }

  param.hideOnNode = !isSlotActive;

  const existingInputIndex = props.value.inputs.findIndex(i => i.id === param.id);
  if (existingInputIndex !== -1) {
    const slot = props.value.inputs[existingInputIndex];
    slot.hideOnNode = !isSlotActive;
    props.value.setSize(props.value.computeSize());
  }
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新回调函数状态
function updateParamCallback(param, isCallback) {
  if (!param) {
    console.error('updateParamCallback: param is undefined');
    return;
  }

  param.isCallback = isCallback;

  const existingInputIndex = props.value.inputs.findIndex(i => i.id === param.id);

  if (isCallback) {
    // 设置为回调函数时，创建 function 类型的 slot，shape = 6
    if (existingInputIndex !== -1) {
      props.value.removeInput(existingInputIndex);
    }
    // isFunction 回调 valueMode='value':子图内拿 wire 真值(上游 funcOut 的 __FUNC_<id>__ 占位符)
    props.value.addInput(param.name, 'function', { id: param.id, shape: 5, hideOnNode: false, valueMode: 'value' });
    // 当设置为回调函数时，强制 hideOnNode 为 false（显示slot）
    param.hideOnNode = false;
  } else {
    // 取消回调函数时，恢复为普通 string 类型的 slot
    if (existingInputIndex !== -1) {
      props.value.removeInput(existingInputIndex);
    }
    // 普通参数 valueMode='label':子图内拿参数名字符串
    props.value.addInput(param.name, 'string', { id: param.id, hideOnNode: param.hideOnNode, valueMode: 'label' });
  }


}

function updateParamName(param, newName) {
  if (!param) {
    console.error('updateParamName: param is undefined');
    return;
  }

  param.name = newName;
  // 如果slot存在，更新其名称
  if (!param.hideOnNode) {
    const slot = props.value.inputs.find(i => i.id === param.id);
    if (slot) {
      slot.name = newName;
      props.value.graph?.setDirtyCanvas?.(true, true);
    }
  }
}

// === 传入参数管理函数（数据流入节点）===
function addPassIn() {
  const newParam = {
    id: uid(),
    name: `in${properties.value.passIn.length}`
  };

  properties.value.passIn.push(newParam);
  // 添加输入槽，标记为 isPassIn 区分于普通参数
  props.value.addInput(newParam.name, 'string', {
    id: newParam.id,
    isPassIn: true,
    hideOnNode: props.value.showPassInSlots === false,
  });
}

function removePassIn(paramId, index) {
  const existingIndex = props.value.inputs.findIndex(i => i.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeInput(existingIndex);
    properties.value.passIn.splice(index, 1);
  }
}

function updatePassInName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.inputs.find(i => i.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// === 传出参数管理函数（数据流出节点）===
function addPassOut() {
  const newParam = {
    id: uid(),
    name: `out${properties.value.passOut.length}`
  };

  properties.value.passOut.push(newParam);
  // 添加输出槽
  props.value.addOutput(newParam.name, 'string', {
    id: newParam.id,
    hideOnNode: props.value.showPassOutSlots === false,
  });
}

function removePassOut(paramId, index) {
  const existingIndex = props.value.outputs.findIndex(o => o.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeOutput(existingIndex);
    properties.value.passOut.splice(index, 1);
  }
}

function updatePassOutName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.outputs.find(o => o.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

</script>

<template>
  <BasePropertyPanel v-model="props" code-filename="function-block.js">
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- 基础声明控制 -->
          <div class="row items-center q-mb-xs">
            <q-checkbox dense dark :model-value="properties.exported"
              @update:model-value="val => updateField('exported', val)" label="export"
              :disable="isFuncOutConnected || properties.enableDeclaration" />
            <q-checkbox dense dark :model-value="properties.async"
              @update:model-value="val => updateField('async', val)" label="async" class="q-ml-sm" />
          </div>

          <!-- 函数名 -->
          <div class="q-mt-sm">
            <div class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-toggle dense dark :model-value="properties.enableDeclaration" label="FuncName"
                @update:model-value="val => updateField('enableDeclaration', val)" :disable="isFuncOutConnected"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :model-value="properties.functionName"
                @update:model-value="val => updateFunctionName(val)" placeholder="函数名"
                :disable="isFuncOutConnected || shouldDisableFunctionNameInput">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      函数的名称<br />
                      示例: handleClick, fetchData
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <!-- 参数列表 -->
          <div class="q-mt-md">
            <div class="text-caption">参数</div>
            <div v-for="(p, index) in (properties.params || [])" :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <!-- slot toggle -->
              <q-toggle :model-value="!p.hideOnNode" @update:model-value="(val) => updateParamSlot(p, val)" dense dark
                style="flex-shrink: 0;" />

              <!-- callback toggle: slot 为 false 时禁用 -->
              <q-toggle :model-value="p.isCallback || false" @update:model-value="(val) => updateParamCallback(p, val)"
                dense dark label="Func" :disable="p.hideOnNode" style="min-width: 70px; flex-shrink: 0;" />

              <!-- 参数名输入框: slot 为 true 时禁用 -->
              <q-input dense dark outlined class="col" :model-value="p.name"
                @update:model-value="val => updateParamName(p, val)" placeholder="参数名" :disable="!p.hideOnNode">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      函数参数名<br />
                      示例: item, index, callback
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>

              <!-- 删除按钮 -->
              <q-btn flat dense icon="close" color="negative" @click="removeParam(p.id, index)" />
            </div>
            <q-btn dense flat no-caps label="+ 添加参数" @click="addParam" class="q-mt-sm full-width" color="primary" />
          </div>

          <q-separator dark class="q-my-sm" />

          <!-- 传入列表（数据流入节点）-->
          <div class="q-mt-md">
            <div class="text-caption">传入</div>
            <div v-for="(p, index) in (properties.passIn || [])" :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-input dense dark outlined class="col" :model-value="p.name"
                @update:model-value="val => updatePassInName(p, val)" placeholder="变量名">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      从外部传入的变量名<br />
                      示例: data, config, options
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn flat dense icon="close" color="negative" @click="removePassIn(p.id, index)" />
            </div>
            <q-btn dense flat no-caps label="+ 添加传入" @click="addPassIn" class="q-mt-sm full-width" color="primary" />
          </div>

          <!-- 传出列表（数据流出节点）-->
          <div class="q-mt-md">
            <div class="text-caption">传出</div>
            <div v-for="(p, index) in (properties.passOut || [])" :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-input dense dark outlined class="col" :model-value="p.name"
                @update:model-value="val => updatePassOutName(p, val)" placeholder="变量名">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      传出到外部的变量名<br />
                      示例: result, output, response
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn flat dense icon="close" color="negative" @click="removePassOut(p.id, index)" />
            </div>
            <q-btn dense flat no-caps label="+ 添加传出" @click="addPassOut" class="q-mt-sm full-width" color="primary" />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
