<script setup>
import { computed, watch } from "vue";
import { uid } from "quasar";
import { useProjectStore } from "src/stores/projectMange.js";
import { runStep } from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";

const project = useProjectStore();
const backendFileTypes = ["serviceGraph", "serviceCode", "functionGraph", "functionCode"];

const backendFile = computed(() => {
  const currentSelect = project.getCurrentSelect();
  const node =
    (project.getBackendTreeData() || []).find((item) => item.id === currentSelect) ||
    null;
  return backendFileTypes.includes(node?.templateType) ? node : null;
});

const kind = computed(() => {
  const type = backendFile.value?.templateType || "";
  return type.startsWith("function") ? "function" : "service";
});

const config = computed(() => backendFile.value?.config || null);

const methodOptions = ["GET", "POST", "PUT", "DELETE", "PATCH"];

function createDefaultConfig(fileKind) {
  return fileKind === "function"
    ? {
        functionName: "",
        params: [],
      }
    : {
        method: "POST",
        routePath: "",
        autoRoute: true,
        params: [],
        notifyOnSuccess: false,
      };
}

function syncBackendFile(file, fileKind) {
  if (!file) return;
  if (!file.label) file.label = file.name;
  if (!file.config) file.config = createDefaultConfig(fileKind);
  ensureConfigShape(file.config, fileKind);
}

function ensureConfigShape(target, fileKind) {
  if (fileKind === "function") {
    if (target.functionName === undefined) target.functionName = "";
    if (!Array.isArray(target.params)) target.params = [];
    return;
  }

  if (!target.method) target.method = "POST";
  if (target.routePath === undefined) target.routePath = "";
  if (target.autoRoute === undefined) target.autoRoute = true;
  if (!Array.isArray(target.params)) target.params = [];
  if (target.notifyOnSuccess === undefined) target.notifyOnSuccess = false;
}

function addParam(listName, prefix) {
  if (!config.value?.[listName]) return;
  config.value[listName].push({
    id: uid(),
    name: `${prefix}${config.value[listName].length}`,
  });
}

function removeParam(listName, index) {
  config.value?.[listName]?.splice(index, 1);
}

watch(
  () => [backendFile.value, kind.value],
  ([file, fileKind]) => syncBackendFile(file, fileKind),
  { immediate: true },
);

watch(
  config,
  () => {
    if (!config.value) return;
    try {
      runStep();
    } catch (_) {}
  },
  { deep: true },
);
</script>

<template>
  <div v-if="backendFile && config" class="column fit text-white">
    <q-card dark flat class="q-mb-xs">
      <q-card-section class="q-pa-sm">
        <div class="text-caption text-grey-6 q-mb-xs">Instance ID</div>
        <div class="text-body2 text-mono" style="word-break: break-all">
          {{ backendFile.id }}
        </div>
      </q-card-section>
    </q-card>

    <div class="col scroll column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5">
            {{ kind === "service" ? "Service Config" : "Function Config" }}
          </div>
          <q-input
            v-model="backendFile.name"
            dense
            dark
            outlined
            class="q-mt-xs"
            label="Name"
          />
        </q-card-section>
      </q-card>

      <template v-if="kind === 'service'">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey-5">Request</div>
            <div class="row q-gutter-x-sm q-mt-xs">
              <q-select
                v-model="config.method"
                dense
                dark
                outlined
                class="col-4"
                :options="methodOptions"
                label="Method"
              />
              <q-input
                v-model="config.routePath"
                dense
                dark
                outlined
                class="col"
                :disable="config.autoRoute"
                placeholder="/api/your/path"
              />
            </div>
            <q-toggle v-model="config.autoRoute" dense dark label="Auto route" />
            <q-toggle
              v-model="config.notifyOnSuccess"
              dense
              dark
              label="Notify on success"
            />
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey-5">Request Params</div>
            <div
              v-for="(p, index) in config.params"
              :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
            >
              <q-input
                v-model="p.name"
                dense
                dark
                outlined
                class="col"
                placeholder="fieldName"
              />
              <q-btn
                flat
                dense
                icon="close"
                color="negative"
                @click="removeParam('params', index)"
              />
            </div>
            <q-btn
              dense
              flat
              no-caps
              label="+ Add param"
              class="q-mt-sm full-width"
              color="primary"
              @click="addParam('params', 'param')"
            />
          </q-card-section>
        </q-card>
      </template>

      <template v-else>
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey-5">Function</div>
            <q-input
              v-model="config.functionName"
              dense
              dark
              outlined
              class="q-mt-xs"
              label="Function name"
              :placeholder="backendFile.name"
            />
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey-5">Function Params</div>
            <div
              v-for="(p, index) in config.params"
              :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap"
            >
              <q-input
                v-model="p.name"
                dense
                dark
                outlined
                class="col"
                placeholder="paramName"
              />
              <q-btn
                flat
                dense
                icon="close"
                color="negative"
                @click="removeParam('params', index)"
              />
            </div>
            <q-btn
              dense
              flat
              no-caps
              label="+ Add param"
              class="q-mt-sm full-width"
              color="primary"
              @click="addParam('params', 'param')"
            />
          </q-card-section>
        </q-card>
      </template>
    </div>
  </div>
</template>
