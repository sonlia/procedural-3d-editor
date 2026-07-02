<template>
  <q-card class="doc-api q-my-xl" flat bordered dark>
    <div class="header-toolbar row items-center q-pr-sm">
      <DocCardTitle :title="nameBanner" />

      <div
        class="col doc-api__search-field row items-center no-wrap"
        @click="onSearchFieldClick"
      >
        <input
          class="col doc-api__search text-right"
          ref="inputRef"
          v-model="filter"
          name="filter"
          placeholder="Filter..."
        />
        <q-btn
          :icon="inputIcon"
          class="header-btn q-ml-xs"
          dense
          flat
          round
          @click="onFilterClick"
        />
      </div>

      <q-btn
        class="q-ml-sm header-btn"
        v-if="props.pageLink"
        size="sm"
        padding="xs sm"
        no-caps
        outline
        :to="docPath"
      >
        <q-icon name="launch" />
        <div class="q-ml-xs">Docs</div>
      </q-btn>
    </div>

    <q-linear-progress
      v-if="loading"
      color="brand-primary"
      indeterminate
      class="q-mt-xs"
    />
    <template v-else-if="nothingToShow">
      <q-separator />
      <div class="doc-api__nothing-to-show">Nothing to display</div>
    </template>
    <template v-else>
      <q-tabs
        class="header-tabs"
        v-model="currentTab"
        active-color="brand-primary"
        indicator-color="brand-primary"
        align="left"
        :breakpoint="0"
      >
        <q-tab
          v-for="tab in tabsList"
          :key="`api-tab-${tab}`"
          :name="tab"
          class="header-btn"
        >
          <div class="row no-wrap items-center">
            <span class="q-mr-xs text-capitalize">{{ tab }}</span>
            <q-badge
              v-if="filteredApiCount[tab].overall"
              :label="filteredApiCount[tab].overall"
            />
          </div>
        </q-tab>
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="currentTab" animated>
        <q-tab-panel
          class="q-pa-none"
          v-for="tab in tabsList"
          :name="tab"
          :key="tab"
        >
          <div
            class="doc-api__container row no-wrap"
            v-if="innerTabsList[tab].length !== 1"
          >
            <div class="col-auto">
              <q-tabs
                class="header-tabs doc-api__subtabs"
                v-model="currentInnerTab"
                active-color="brand-primary"
                indicator-color="brand-primary"
                :breakpoint="0"
                vertical
                dense
                shrink
              >
                <q-tab
                  class="doc-api__subtabs-item header-btn"
                  v-for="innerTab in innerTabsList[tab]"
                  :key="`api-inner-tab-${innerTab}`"
                  :name="innerTab"
                >
                  <div class="row no-wrap items-center self-stretch q-pl-sm">
                    <span class="q-mr-xs text-capitalize">{{ innerTab }}</span>
                    <div class="col" />
                    <q-badge
                      v-if="filteredApiCount[tab].category[innerTab]"
                      :label="filteredApiCount[tab].category[innerTab]"
                    />
                  </div>
                </q-tab>
              </q-tabs>
            </div>

            <q-separator vertical />

            <q-tab-panels
              class="col"
              v-model="currentInnerTab"
              animated
              transition-prev="slide-down"
              transition-next="slide-up"
            >
              <q-tab-panel
                class="q-pa-none"
                v-for="innerTab in innerTabsList[tab]"
                :name="innerTab"
                :key="innerTab"
              >
                <DocApiEntry
                  :type="tab"
                  :definition="filteredApi[tab][innerTab]"
                />
              </q-tab-panel>
            </q-tab-panels>
          </div>
          <div class="doc-api__container" v-else>
            <DocApiEntry
              :type="tab"
              :definition="filteredApi[tab][defaultInnerTabName]"
            />
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </q-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";

import DocCardTitle from "./DocCardTitle.vue";
import DocApiEntry from "./DocApiEntry.js";

const defaultInnerTabName = "__default";

function getPropsCategories(props) {
  const acc = new Set();

  for (const key in props) {
    if (props[key] !== void 0) {
      const value = props[key];

      value.category.split("|").forEach((groupKey) => {
        acc.add(groupKey);
      });
    }
  }

  return acc.size === 1 ? [defaultInnerTabName] : Array.from(acc).sort();
}

function getInnerTabs(api, tabs, apiType) {
  const acc = {};

  tabs.forEach((tab) => {
    acc[tab] =
      apiType === "component" && tab === "props"
        ? getPropsCategories(api[tab])
        : [defaultInnerTabName];
  });

  return acc;
}

function parseApi(api, tabs, innerTabs) {
  const acc = {};

  tabs.forEach((tab) => {
    const apiValue = api[tab];

    if (innerTabs[tab].length > 1) {
      const inner = {};

      innerTabs[tab].forEach((subTab) => {
        inner[subTab] = {};
      });

      for (const key in apiValue) {
        if (apiValue[key] !== void 0) {
          const value = apiValue[key];

          value.category.split("|").forEach((groupKey) => {
            inner[groupKey][key] = value;
          });
        }
      }

      acc[tab] = inner;
    } else {
      acc[tab] = {};
      acc[tab][defaultInnerTabName] = apiValue;
    }
  });

  return acc;
}

function passesFilter(filter, name, desc) {
  return (
    name.toLowerCase().indexOf(filter) > -1 ||
    (desc !== void 0 && desc.toLowerCase().indexOf(filter) > -1)
  );
}

function getFilteredApi(parsedApi, filter, tabs, innerTabs) {
  if (filter === "") {
    return parsedApi;
  }

  const acc = {};

  tabs.forEach((tab) => {
    if (tab === "injection") {
      const name = parsedApi[tab][defaultInnerTabName];
      acc[tab] = {};
      acc[tab][defaultInnerTabName] =
        passesFilter(filter, name, "") === true ? name : {};
      return;
    }

    if (tab === "quasarConfOptions") {
      const api = parsedApi[tab][defaultInnerTabName];
      acc[tab] = {};
      acc[tab][defaultInnerTabName] = {
        ...api,
        definition: {},
      };
      const result = acc[tab][defaultInnerTabName];

      for (const name in api.definition || {}) {
        const entry = api.definition[name];
        if (passesFilter(filter, name, entry.desc) === true) {
          result.definition[name] = entry;
        }
      }

      if (
        Object.keys(result.definition).length === 0 &&
        passesFilter(filter, api.propName, "") === false
      ) {
        acc[tab][defaultInnerTabName] = {};
      }

      return;
    }

    const tabApi = parsedApi[tab];
    const tabCategories = innerTabs[tab];

    acc[tab] = {};
    tabCategories.forEach((categ) => {
      const subTabs = {};
      const categoryEntries = tabApi[categ];

      for (const name in categoryEntries) {
        const entry = categoryEntries[name];
        if (passesFilter(filter, name, entry.desc) === true) {
          subTabs[name] = entry;
        }
      }

      acc[tab][categ] = subTabs;
    });
  });

  return acc;
}

function getApiCount(parsedApi, tabs, innerTabs) {
  const acc = {};

  tabs.forEach((tab) => {
    const tabApi = parsedApi[tab];
    const tabCategories = innerTabs[tab];

    if (["value", "arg", "injection"].includes(tab)) {
      acc[tab] = {
        overall: Object.keys(tabApi[tabCategories[0]]).length === 0 ? 0 : 1,
      };
      return;
    }

    if (tab === "quasarConfOptions") {
      const api = tabApi[tabCategories[0]];
      acc[tab] = {
        overall:
          Object.keys(api).length === 0
            ? 0
            : api.definition === void 0
              ? 1
              : Object.keys(api.definition).length,
      };
      return;
    }

    acc[tab] = { overall: 0 };

    if (tabCategories.length === 1) {
      const categ = tabCategories[0];
      const count = Object.keys(tabApi[categ]).length;

      acc[tab] = {
        overall: count,
        category: { [categ]: count },
      };
    } else {
      acc[tab].category = {};

      tabCategories.forEach((categ) => {
        const count = Object.keys(tabApi[categ]).length;
        acc[tab].category[categ] = count;
        acc[tab].overall += count;
      });
    }
  });

  return acc;
}

const getJsonUrl = (file) => {
  // 使用本地缓存的 JSON 文件
  return `/src/components/editor/nodeEditor/node/uiNode/quasar/${file}.json`;
};

const props = defineProps({
  file: {
    type: String,
    required: true,
  },

  pageLink: Boolean,
});

const inputRef = ref(null);

const loading = ref(true);
const nameBanner = ref(`Loading ${props.file} API...`);
const nothingToShow = ref(false);

const docPath = ref("");

const filter = ref("");
const apiDef = ref({});

const tabsList = ref([]);
const innerTabsList = ref({});

const currentTab = ref(null);
const currentInnerTab = ref(null);

watch(currentTab, (val) => {
  currentInnerTab.value = innerTabsList.value[val][0];
});

const inputIcon = computed(() =>
  filter.value !== "" ? "mdiClose" : "mdiMagnify",
);
const filteredApi = computed(() =>
  getFilteredApi(
    apiDef.value,
    filter.value.toLowerCase(),
    tabsList.value,
    innerTabsList.value,
  ),
);
const filteredApiCount = computed(() =>
  getApiCount(filteredApi.value, tabsList.value, innerTabsList.value),
);

function parseApiFile(name, { type, behavior, meta, addedIn, ...api }) {
  nameBanner.value = `${name} API`;
  docPath.value = meta.docsUrl.replace(/^https:\/\/v[\d]+\.quasar\.dev/, "");

  const { internal: _, ...apiSections } = api;
  const tabs = Object.keys(apiSections);

  if (tabs.length === 0) {
    nothingToShow.value = true;
    return;
  }

  tabsList.value = tabs;
  currentTab.value = tabs[0];

  const subTabs = getInnerTabs(api, tabs, type);
  innerTabsList.value = subTabs;
  apiDef.value = parseApi(api, tabs, subTabs);
}

function onSearchFieldClick() {
  inputRef.value.focus();
}

function onFilterClick() {
  if (filter.value !== "") {
    filter.value = "";
  }
}

onMounted(async () => {
  try {
    const response = await fetch(getJsonUrl(props.file));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    parseApiFile(props.file, json);
    loading.value = false;
  } catch (error) {
    console.error('Failed to fetch API data:', error);
    loading.value = false;
    nothingToShow.value = true;
  }
});
</script>

<style lang="scss">
.doc-api {
  background-color: #1d1d1d;
  color: rgba(255, 255, 255, 0.87);
}

.doc-api__subtabs .q-tabs__content {
  padding: 8px 0;
}

.doc-api__subtabs-item {
  justify-content: left;
  min-height: 36px !important;
}

.doc-api__subtabs-item .q-tab__content {
  width: 100%;
}

.doc-api__subtabs,
.doc-api__subtabs-item {
  border-radius: 0 !important;
}

.doc-api__container {
  max-height: 600px;
  overflow-y: auto;
}

.doc-api__nothing-to-show {
  padding: 16px;
  color: rgba(255, 255, 255, 0.6);
}

.doc-api__search-field {
  cursor: text;
  min-width: 10em !important;
}

.doc-api__search {
  border: 0;
  outline: 0;
  background: none;
  color: rgba(255, 255, 255, 0.87);
  width: 1px !important;
  height: 37px;
}

.doc-api-entry {
  padding: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.doc-api-entry .doc-api-entry {
  padding: 8px;
}

.doc-api-entry + .doc-api-entry {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.doc-api-entry__expand-btn {
  margin-left: 4px;
}

.doc-api-entry__item {
  min-height: 25px;
}

.doc-api-entry__item + .doc-api-entry__item {
  margin-top: 4px;
}

.doc-api-entry__subitem {
  padding: 4px 0 0 8px;
  border-radius: 4px;
}

.doc-api-entry__subitem > div {
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: inherit;
}

.doc-api-entry__subitem > div + div {
  margin-top: 8px;
}

.doc-api-entry__type {
  line-height: 24px;
}

.doc-api-entry__value {
  color: rgba(255, 255, 255, 0.6);
}

.doc-api-entry--indent {
  padding-left: 8px;
}

.doc-api .doc-token {
  margin: 4px;
  display: inline-block;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.87);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
}

.doc-api-entry__added-in,
.doc-api-entry__pill {
  font-size: 12px;
  letter-spacing: 0.5px;
  line-height: 1.4em;
}

.doc-api-entry__added-in {
  font-size: 11px;
  color: #ff5252;
  border: 1px solid #ff5252;
  background-color: rgba(255, 82, 82, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
}

.doc-api-entry__pill {
  color: #1d1d1d;
  padding: 2px 8px;
  border-radius: 12px;
}

.header-toolbar {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background-color: #2a2a2a;
}

.header-btn {
  color: rgba(255, 255, 255, 0.7);
}

.header-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}

.header-tabs {
  background-color: #2a2a2a;
}

/* 滚动条样式 */
.doc-api__container::-webkit-scrollbar {
  width: 8px;
}

.doc-api__container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.doc-api__container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.doc-api__container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
