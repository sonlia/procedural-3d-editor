<template>
  <div class="column full-height">
    <q-splitter v-model="splitterModel" :limits="[24, 48]" dark class="col">
      <template #before>
        <ResourceTree @upload="handleUploadRequest" />
      </template>

      <template #after>
        <div class="column full-height">
          <ResourceGallery @upload="handleUploadRequest" />

          <q-dialog v-model="uploadDialog" dark>
            <q-card dark flat bordered class="upload-dialog column">
              <div class="row items-center q-pa-sm q-gutter-x-sm">
                <q-icon name="cloud_upload" color="primary" size="sm" />
                <div class="text-body2 ellipsis col">{{ uploadTitle }}</div>
                <q-btn v-close-popup dense flat round size="sm" icon="close" />
              </div>
              <q-separator dark />
              <div class="col">
                <ResourceUpload
                  ref="uploadPanelRef"
                  :target-node="uploadTargetNode"
                  @uploaded="handleUploaded"
                />
              </div>
            </q-card>
          </q-dialog>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from "vue";
import ResourceTree from "src/components/leftWidget/resources/resourceTree.vue";
import ResourceGallery from "./ResourceGallery.vue";
import ResourceUpload from "./ResourceUpload.vue";

const splitterModel = ref(30);
const uploadPanelRef = ref(null);
const uploadTargetNode = ref(null);
const uploadDialog = ref(false);

const uploadTitle = computed(() => `上传到 ${uploadTargetNode.value?.name || "资源根目录"}`);

const handleUploadRequest = async (targetNode) => {
  uploadTargetNode.value = targetNode || null;
  uploadDialog.value = true;
  await nextTick();
  uploadPanelRef.value?.triggerFileInput?.();
};

const handleUploaded = () => {
  uploadDialog.value = false;
};
</script>

<style scoped>
.upload-dialog {
  width: min(720px, 92vw);
  height: min(560px, 82vh);
}
</style>
