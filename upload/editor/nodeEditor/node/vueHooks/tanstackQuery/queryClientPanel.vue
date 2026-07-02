<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isQueryClient = computed(() => nodeType.value === "useQueryClient");
const isUseQueries = computed(() => nodeType.value === "useQueries");
const isInvalidateQueries = computed(() => nodeType.value === "invalidateQueries");
const isSetQueryData = computed(() => nodeType.value === "setQueryData");

const hookDescription = computed(() => {
  if (isQueryClient.value) return "获取 QueryClient 实例，用于手动操作缓存";
  if (isUseQueries.value) return "并行执行多个查询";
  if (isInvalidateQueries.value) return "使查询缓存失效，触发重新获取";
  if (isSetQueryData.value) return "直接设置缓存数据（乐观更新）";
  return "";
});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("VarName", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, slotName, isSlot) {
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];

const refetchTypeOptions = [
  { label: "active", value: "active", description: "仅重新获取活跃查询" },
  { label: "inactive", value: "inactive", description: "仅重新获取非活跃查询" },
  { label: "all", value: "all", description: "重新获取所有匹配查询" },
  { label: "none", value: "none", description: "不重新获取" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">{{ hookDescription }}</div>

      <!-- useQueryClient 面板 -->
      <template v-if="isQueryClient">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <q-checkbox dense dark label="Export" :disable="properties.outputVar?.isSlot"
              :model-value="properties.exported"
              @update:model-value="v => updateField('exported', v)" class="q-mb-xs" />
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="VarName"
                :model-value="properties.outputVar?.isSlot"
                @update:model-value="v => updateVarNameSlot(v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-select dense dark outlined :disable="properties.outputVar?.isSlot"
                :model-value="properties.declareType"
                @update:model-value="v => updateField('declareType', v)"
                :options="declareTypeOptions" emit-value map-options class="col-auto">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <q-input dense dark outlined class="col" :disable="properties.outputVar?.isSlot"
                :model-value="properties.outputVar?.value"
                @update:model-value="v => updateField('outputVar.value', v)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      QueryClient 实例变量名<br />
                      示例: queryClient
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">常用方法</div>
            <div class="column q-gutter-y-xs text-caption">
              <div>
                <span class="text-blue-4">invalidateQueries(queryKey)</span>
                <div class="text-grey q-ml-sm">使查询缓存失效，触发重新获取</div>
              </div>
              <div>
                <span class="text-blue-4">setQueryData(queryKey, data)</span>
                <div class="text-grey q-ml-sm">直接设置缓存数据（乐观更新）</div>
              </div>
              <div>
                <span class="text-blue-4">getQueryData(queryKey)</span>
                <div class="text-grey q-ml-sm">获取缓存中的数据</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useQueries 面板 -->
      <template v-if="isUseQueries">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <q-checkbox dense dark label="Export" :disable="properties.outputVar?.isSlot"
              :model-value="properties.exported"
              @update:model-value="v => updateField('exported', v)" class="q-mb-xs" />
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="VarName"
                :model-value="properties.outputVar?.isSlot"
                @update:model-value="v => updateVarNameSlot(v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-select dense dark outlined :disable="properties.outputVar?.isSlot"
                :model-value="properties.declareType"
                @update:model-value="v => updateField('declareType', v)"
                :options="declareTypeOptions" emit-value map-options class="col-auto">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <q-input dense dark outlined class="col" :disable="properties.outputVar?.isSlot"
                :model-value="properties.outputVar?.value"
                @update:model-value="v => updateField('outputVar.value', v)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      查询结果数组变量名<br />
                      示例: queries, userQueries
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">queries 配置</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接一个查询配置数组
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">combine 函数（可选）</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，合并多个查询结果
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">使用示例</div>
            <div class="column q-gutter-y-xs text-caption" style="font-family: monospace;">
              <div class="text-grey">// queries 配置数组</div>
              <div>users.map(id => ({</div>
              <div class="q-ml-sm">queryKey: ['user', id],</div>
              <div class="q-ml-sm">queryFn: () => fetchUser(id)</div>
              <div>}))</div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- invalidateQueries 面板 -->
      <template v-if="isInvalidateQueries">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">queryKey（可选）</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="queryKey"
                :model-value="properties.queryKey?.isSlot"
                @update:model-value="v => updateParamSlot(properties.queryKey, 'queryKey', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.queryKey?.isSlot"
                :model-value="properties.queryKey?.value"
                @update:model-value="v => updateField('queryKey.value', v)"
                placeholder="['users']">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      要失效的查询键<br />
                      示例: ['users'], ['user', userId]
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">选项</div>
            <div class="column q-gutter-y-xs">
              <q-checkbox dense dark
                :model-value="properties.exact"
                @update:model-value="v => updateField('exact', v)"
                label="精确匹配">
                <q-tooltip class="bg-dark" max-width="250px">
                  仅失效完全匹配 queryKey 的查询
                </q-tooltip>
              </q-checkbox>
              <q-select dense dark outlined
                :model-value="properties.refetchType"
                @update:model-value="v => updateField('refetchType', v)"
                :options="refetchTypeOptions" emit-value map-options label="重新获取类型">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">可用输出</div>
            <div class="column q-gutter-y-xs text-caption">
              <div><span class="text-blue-4">invalidate</span> - 触发失效的函数</div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- setQueryData 面板 -->
      <template v-if="isSetQueryData">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">queryKey</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="queryKey"
                :model-value="properties.queryKey?.isSlot"
                @update:model-value="v => updateParamSlot(properties.queryKey, 'queryKey', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.queryKey?.isSlot"
                :model-value="properties.queryKey?.value"
                @update:model-value="v => updateField('queryKey.value', v)"
                placeholder="['user', userId]">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      要更新的查询键<br />
                      示例: ['users'], ['user', userId]
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">updater 函数</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，参数: oldData
            </div>
            <div class="text-caption text-grey q-mt-xs">
              返回新数据来更新缓存
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">可用输出</div>
            <div class="column q-gutter-y-xs text-caption">
              <div><span class="text-blue-4">setData</span> - 触发更新的函数</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">使用示例</div>
            <div class="column q-gutter-y-xs text-caption" style="font-family: monospace;">
              <div class="text-grey">// updater 函数示例</div>
              <div>(oldData) => ({</div>
              <div class="q-ml-sm">...oldData,</div>
              <div class="q-ml-sm">name: 'New Name'</div>
              <div>})</div>
            </div>
          </q-card-section>
        </q-card>
      </template>
    </div>
  </BasePropertyPanel>
</template>
