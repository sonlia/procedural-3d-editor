<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

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
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">获取、缓存和自动刷新服务端数据</div>

      <!-- 卡片 1：输出变量 -->
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
                    查询结果对象变量名<br />
                    示例: userQuery, postsQuery
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：查询键 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">查询键 (queryKey)</div>
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
                    唯一标识查询的键数组<br />
                    示例: ['users'], ['user', userId], ['posts', { page }]
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：查询函数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">查询函数 (queryFn)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点，参数: context (包含 queryKey, signal 等)
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：缓存选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">缓存选项</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="staleTime"
                :model-value="properties.staleTime?.isSlot"
                @update:model-value="v => updateParamSlot(properties.staleTime, 'staleTime', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.staleTime?.isSlot"
                :model-value="properties.staleTime?.value"
                @update:model-value="v => updateField('staleTime.value', v)"
                placeholder="0">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      数据保持新鲜的时间（毫秒）<br />
                      示例: 0, 5000, 60000, Infinity
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="gcTime"
                :model-value="properties.gcTime?.isSlot"
                @update:model-value="v => updateParamSlot(properties.gcTime, 'gcTime', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.gcTime?.isSlot"
                :model-value="properties.gcTime?.value"
                @update:model-value="v => updateField('gcTime.value', v)"
                placeholder="300000">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      缓存垃圾回收时间（毫秒）<br />
                      示例: 300000 (5分钟), Infinity
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 5：重新获取选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">重新获取选项</div>
          <div class="column q-gutter-y-xs">
            <q-checkbox dense dark
              :model-value="properties.refetchOnWindowFocus"
              @update:model-value="v => updateField('refetchOnWindowFocus', v)"
              label="窗口聚焦时重新获取">
              <q-tooltip class="bg-dark" max-width="250px">
                窗口重新获得焦点时自动刷新数据
              </q-tooltip>
            </q-checkbox>
            <q-checkbox dense dark
              :model-value="properties.refetchOnMount"
              @update:model-value="v => updateField('refetchOnMount', v)"
              label="挂载时重新获取">
              <q-tooltip class="bg-dark" max-width="250px">
                组件挂载时自动刷新数据
              </q-tooltip>
            </q-checkbox>
            <q-checkbox dense dark
              :model-value="properties.refetchOnReconnect"
              @update:model-value="v => updateField('refetchOnReconnect', v)"
              label="重连时重新获取">
              <q-tooltip class="bg-dark" max-width="250px">
                网络重新连接时自动刷新数据
              </q-tooltip>
            </q-checkbox>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 6：其他选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">其他选项</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="enabled"
                :model-value="properties.enabled?.isSlot"
                @update:model-value="v => updateParamSlot(properties.enabled, 'enabled', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.enabled?.isSlot"
                :model-value="properties.enabled?.value"
                @update:model-value="v => updateField('enabled.value', v)"
                placeholder="true">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      是否启用查询<br />
                      示例: true, !!userId, computed(() => !!id.value)
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="retry"
                :model-value="properties.retry?.isSlot"
                @update:model-value="v => updateParamSlot(properties.retry, 'retry', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.retry?.isSlot"
                :model-value="properties.retry?.value"
                @update:model-value="v => updateField('retry.value', v)"
                placeholder="3">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      失败重试次数<br />
                      示例: 3, 0, false
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 7：输出说明 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">data</span> - 查询返回的数据</div>
            <div><span class="text-blue-4">error</span> - 错误信息</div>
            <div><span class="text-blue-4">isLoading</span> - 首次加载中</div>
            <div><span class="text-blue-4">isFetching</span> - 正在获取数据</div>
            <div><span class="text-blue-4">isError</span> - 是否出错</div>
            <div><span class="text-blue-4">isSuccess</span> - 是否成功</div>
            <div><span class="text-blue-4">refetch</span> - 手动刷新函数</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
