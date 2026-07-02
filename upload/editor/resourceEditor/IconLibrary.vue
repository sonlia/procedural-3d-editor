<template>
  <div class="column full-height q-pa-sm bg-dark">
    <!-- 搜索和筛选 -->
    <div class="row items-center q-gutter-x-sm q-mb-sm">
      <q-input
        v-model="searchQuery"
        dark
        dense
        outlined
        placeholder="搜索图标..."
        class="col"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
        <template #append>
          <q-icon
            v-if="searchQuery"
            name="close"

            class="cursor-pointer"
            @click="searchQuery = ''"
          />
        </template>
      </q-input>

      <q-select
        v-model="selectedLibrary"
        :options="iconLibraryOptions"
        dark
        dense
        outlined
        emit-value
        map-options
        style="min-width: 140px"
        @update:model-value="onLibraryChange"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="col row items-center justify-center">
      <q-spinner color="primary" />
      <span class="q-ml-sm text-grey-5 text-caption">加载图标库...</span>
    </div>

    <!-- 图标网格 -->
    <div v-else class="col overflow-auto">
      <div v-if="filteredIcons.length" class="icon-grid">
        <div
          v-for="icon in filteredIcons"
          :key="icon.name"
          class="icon-item"
          :class="{ active: selectedIcon?.name === icon.name }"
          @click="selectIcon(icon)"
        >
          <!-- Material Icons -->
          <q-icon v-if="isMaterialLibrary" :name="icon.name" size="20px" />
          <!-- Ionicons 使用 ion-icon 原生元素 -->
          <ion-icon v-else-if="selectedLibrary === 'ionicons'" :name="icon.name" style="font-size: 20px" />
          <!-- 其他图标库 -->
          <q-icon v-else :name="icon.name" size="20px" />
          <q-tooltip>{{ icon.label || icon.name }}</q-tooltip>
        </div>
      </div>
      <div v-else class="text-center text-grey-6 q-pa-md">
        <q-icon name="search_off" />
        <div class="text-caption q-mt-xs">未找到匹配的图标</div>
      </div>
    </div>

    <!-- 图标数量 -->
    <div class="text-caption text-grey-6 q-mt-xs">
      共 {{ filteredIcons.length }} / {{ currentIconList.length }} 个图标
    </div>

    <!-- 选中的图标 -->
    <div v-if="selectedIcon" class="selected-info q-mt-sm q-pa-xs">
      <div class="row items-center q-gutter-x-sm">
        <q-icon v-if="isMaterialLibrary" :name="selectedIcon.name" size="24px" />
        <ion-icon v-else-if="selectedLibrary === 'ionicons'" :name="selectedIcon.name" style="font-size: 24px" />
        <q-icon v-else :name="selectedIcon.name" size="24px" />
        <div class="col">
          <div class="text-caption">{{ selectedIcon.label || selectedIcon.name }}</div>
          <div class="text-caption text-grey-5">{{ getQuasarIconName(selectedIcon) }}</div>
        </div>
        <q-btn flat dense icon="content_copy" @click="copyIconName">
          <q-tooltip>复制图标名称</q-tooltip>
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { copyToClipboard, useQuasar } from "quasar";

const $q = useQuasar();

const searchQuery = ref("");
const selectedLibrary = ref("material");
const selectedIcon = ref(null);
const loading = ref(false);
const loadedLibraries = ref(new Set(["material"])); // 已加载的图标库

// 图标库配置
const iconLibraries = {
  material: {
    label: "Material Icons",
    prefix: "",
    cdn: null, // Quasar 默认包含
    icons: [], // 动态填充
  },
  "material-outlined": {
    label: "Material Outlined",
    prefix: "o_",
    cdn: null,
    icons: [],
  },
  "material-round": {
    label: "Material Round",
    prefix: "r_",
    cdn: null,
    icons: [],
  },
  "material-sharp": {
    label: "Material Sharp",
    prefix: "s_",
    cdn: null,
    icons: [],
  },
  ionicons: {
    label: "Ionicons",
    prefix: "ion-",
    cdn: "https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js",
    cdnCss: "https://unpkg.com/ionicons@7.1.0/dist/css/ionicons.min.css",
    icons: [],
  },
};

// 图标库选项
const iconLibraryOptions = computed(() =>
  Object.entries(iconLibraries).map(([value, config]) => ({
    label: config.label,
    value,
  }))
);

// 是否为 Material 系列图标库
const isMaterialLibrary = computed(() =>
  selectedLibrary.value.startsWith("material")
);

// Material Icons 完整列表（从 Google Fonts 获取的常用图标）
const materialIconsList = [
  // 动作类
  "add", "remove", "edit", "delete", "save", "close", "check", "refresh", "search", "settings",
  "more_vert", "more_horiz", "done", "done_all", "clear", "backspace", "undo", "redo",
  "content_copy", "content_cut", "content_paste", "select_all", "open_in_new", "open_in_browser",
  "launch", "exit_to_app", "power_settings_new", "login", "logout",
  // 导航类
  "home", "menu", "arrow_back", "arrow_forward", "arrow_upward", "arrow_downward",
  "expand_more", "expand_less", "chevron_left", "chevron_right", "first_page", "last_page",
  "subdirectory_arrow_left", "subdirectory_arrow_right", "unfold_more", "unfold_less",
  "fullscreen", "fullscreen_exit", "apps", "view_list", "view_module", "view_quilt",
  // 文件类
  "folder", "folder_open", "create_new_folder", "folder_special", "folder_shared",
  "insert_drive_file", "description", "article", "note", "note_add", "file_copy",
  "upload", "download", "cloud_upload", "cloud_download", "cloud", "cloud_off",
  "attach_file", "attachment", "file_present", "file_download", "file_upload",
  // 媒体类
  "image", "photo", "photo_library", "photo_camera", "camera_alt", "collections",
  "videocam", "video_library", "movie", "music_note", "audiotrack", "library_music",
  "play_arrow", "pause", "stop", "skip_previous", "skip_next", "fast_rewind", "fast_forward",
  "replay", "loop", "shuffle", "volume_up", "volume_down", "volume_off", "volume_mute",
  // 通讯类
  "email", "mail", "inbox", "drafts", "send", "forward", "reply", "reply_all",
  "chat", "chat_bubble", "message", "forum", "comment", "textsms", "sms",
  "notifications", "notifications_active", "notifications_off", "notifications_none",
  "phone", "call", "phone_enabled", "phone_disabled", "voicemail", "contact_phone",
  // 用户类
  "person", "person_add", "person_remove", "people", "group", "groups", "group_add",
  "account_circle", "account_box", "face", "sentiment_satisfied", "sentiment_dissatisfied",
  "manage_accounts", "admin_panel_settings", "supervised_user_circle", "badge",
  // 状态类
  "info", "info_outline", "warning", "warning_amber", "error", "error_outline",
  "help", "help_outline", "check_circle", "check_circle_outline", "cancel",
  "highlight_off", "report", "report_problem", "block", "do_not_disturb",
  "verified", "new_releases", "priority_high", "low_priority",
  // 收藏类
  "star", "star_border", "star_half", "favorite", "favorite_border",
  "bookmark", "bookmark_border", "bookmarks", "grade", "thumb_up", "thumb_down",
  // 安全类
  "lock", "lock_open", "lock_outline", "vpn_key", "key", "password",
  "visibility", "visibility_off", "security", "shield", "verified_user",
  "privacy_tip", "admin_panel_settings", "policy",
  // 链接类
  "link", "link_off", "share", "public", "language", "translate",
  "print", "qr_code", "qr_code_scanner", "fingerprint",
  // 开发类
  "code", "terminal", "developer_mode", "build", "bug_report", "memory",
  "storage", "dns", "api", "webhook", "data_object", "data_array",
  "integration_instructions", "javascript", "css", "html", "php",
  // 图表类
  "dashboard", "analytics", "assessment", "bar_chart", "pie_chart", "show_chart",
  "trending_up", "trending_down", "trending_flat", "timeline", "insights",
  "leaderboard", "query_stats", "stacked_line_chart",
  // 界面类
  "widgets", "view_sidebar", "view_agenda", "view_carousel", "view_column",
  "table_chart", "table_rows", "grid_view", "list", "format_list_bulleted",
  "format_list_numbered", "sort", "filter_list", "filter_alt",
  "tune", "toggle_on", "toggle_off", "radio_button_checked", "radio_button_unchecked",
  "check_box", "check_box_outline_blank", "indeterminate_check_box",
  // 编辑类
  "format_bold", "format_italic", "format_underlined", "format_strikethrough",
  "format_align_left", "format_align_center", "format_align_right", "format_align_justify",
  "format_indent_increase", "format_indent_decrease", "format_quote", "format_color_text",
  "title", "text_fields", "short_text", "notes", "wrap_text",
  // 形状类
  "circle", "square", "rectangle", "pentagon", "hexagon", "change_history",
  "crop_square", "panorama_fish_eye", "lens", "adjust", "brightness_1",
  // 时间类
  "schedule", "access_time", "timer", "timer_off", "alarm", "alarm_add", "alarm_off",
  "today", "event", "date_range", "calendar_today", "calendar_month",
  "history", "update", "watch_later", "hourglass_empty", "hourglass_full",
  // 地点类
  "place", "location_on", "location_off", "my_location", "near_me", "explore",
  "map", "layers", "terrain", "satellite", "directions", "navigation",
  // 设备类
  "devices", "computer", "laptop", "desktop_windows", "phone_android", "phone_iphone",
  "tablet", "tablet_android", "tablet_mac", "watch", "tv", "cast", "cast_connected",
  "mouse", "keyboard", "headset", "speaker", "mic", "mic_off", "videocam_off",
  // 社交类
  "share", "thumb_up", "thumb_down", "recommend", "rate_review", "reviews",
  "sentiment_very_satisfied", "sentiment_satisfied_alt", "sentiment_neutral",
  "emoji_emotions", "emoji_events", "emoji_flags", "emoji_food_beverage",
  // 电商类
  "shopping_cart", "add_shopping_cart", "remove_shopping_cart", "shopping_bag",
  "shopping_basket", "store", "storefront", "local_mall", "payments", "credit_card",
  "account_balance", "account_balance_wallet", "receipt", "sell", "redeem",
  // 工具类
  "build", "construction", "handyman", "home_repair_service", "plumbing", "electrical_services",
  "carpenter", "architecture", "design_services", "draw", "brush", "color_lens",
  "palette", "format_paint", "gradient", "texture", "invert_colors",
  // 箭头类
  "arrow_back_ios", "arrow_forward_ios", "arrow_left", "arrow_right",
  "keyboard_arrow_up", "keyboard_arrow_down", "keyboard_arrow_left", "keyboard_arrow_right",
  "keyboard_double_arrow_up", "keyboard_double_arrow_down", "keyboard_double_arrow_left", "keyboard_double_arrow_right",
  "north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west",
  "swap_horiz", "swap_vert", "sync", "sync_alt", "compare_arrows", "multiple_stop",
  // 其他常用
  "add_circle", "add_circle_outline", "remove_circle", "remove_circle_outline",
  "add_box", "indeterminate_check_box", "disabled_by_default",
  "bolt", "flash_on", "flash_off", "lightbulb", "highlight",
  "science", "biotech", "psychology", "self_improvement",
  "sports_esports", "videogame_asset", "casino", "extension",
  "smart_toy", "toys", "cruelty_free", "pets", "park", "forest", "nature",
  "wb_sunny", "nights_stay", "cloud_queue", "thunderstorm", "ac_unit", "waves",
];

// Ionicons 图标列表（常用图标）
const ioniconsIconsList = [
  // 基础操作
  "add", "remove", "close", "checkmark", "arrow-back", "arrow-forward", "arrow-up", "arrow-down",
  "chevron-back", "chevron-forward", "chevron-up", "chevron-down", "caret-back", "caret-forward",
  "caret-up", "caret-down", "refresh", "reload", "sync", "search", "options", "settings", "cog",
  "ellipsis-horizontal", "ellipsis-vertical", "menu", "reorder-four", "grid", "list",
  // 文件
  "folder", "folder-open", "document", "document-text", "documents", "file-tray", "file-tray-full",
  "cloud", "cloud-upload", "cloud-download", "cloud-offline", "download", "push", "share", "share-social",
  // 媒体
  "image", "images", "camera", "videocam", "film", "musical-notes", "musical-note", "mic", "mic-off",
  "volume-high", "volume-medium", "volume-low", "volume-mute", "volume-off",
  "play", "pause", "stop", "play-skip-back", "play-skip-forward", "play-back", "play-forward",
  // 通讯
  "mail", "mail-open", "mail-unread", "send", "chatbubble", "chatbubbles", "chatbox", "chatbox-ellipses",
  "notifications", "notifications-off", "alert", "alert-circle", "warning",
  "call", "phone-portrait", "phone-landscape", "tablet-portrait", "tablet-landscape",
  // 用户
  "person", "person-add", "person-remove", "people", "body", "man", "woman",
  "accessibility", "hand-left", "hand-right", "thumbs-up", "thumbs-down",
  // 状态
  "checkmark-circle", "close-circle", "add-circle", "remove-circle", "help-circle", "information-circle",
  "alert-circle", "warning", "ban", "shield", "shield-checkmark",
  // 收藏
  "star", "star-half", "star-outline", "heart", "heart-half", "heart-dislike",
  "bookmark", "bookmarks", "flag", "ribbon", "trophy", "medal",
  // 安全
  "lock-closed", "lock-open", "key", "finger-print", "eye", "eye-off",
  // 社交
  "logo-facebook", "logo-twitter", "logo-instagram", "logo-linkedin", "logo-youtube", "logo-tiktok",
  "logo-github", "logo-gitlab", "logo-bitbucket", "logo-discord", "logo-slack", "logo-twitch",
  "logo-google", "logo-apple", "logo-android", "logo-windows", "logo-chrome", "logo-firefox",
  "logo-npm", "logo-nodejs", "logo-javascript", "logo-html5", "logo-css3", "logo-sass",
  "logo-react", "logo-angular", "logo-vue", "logo-python", "logo-docker", "logo-vercel",
  // 开发
  "code", "code-slash", "code-working", "terminal", "git-branch", "git-commit", "git-merge",
  "git-pull-request", "git-network", "cube", "server", "hardware-chip", "bug",
  // 界面
  "apps", "copy", "clipboard", "cut", "trash", "create", "pencil", "brush", "color-palette",
  "resize", "expand", "contract", "move", "crop", "scan", "qr-code", "barcode",
  // 形状
  "square", "triangle", "ellipse", "shapes", "prism",
  // 导航
  "home", "compass", "navigate", "location", "map", "globe", "earth", "planet",
  // 时间
  "time", "timer", "stopwatch", "hourglass", "alarm", "calendar", "today",
  // 天气
  "sunny", "moon", "cloudy", "cloudy-night", "rainy", "thunderstorm", "snow", "partly-sunny",
  // 其他
  "bulb", "flash", "flashlight", "battery-full", "battery-half", "battery-dead", "battery-charging",
  "wifi", "cellular", "bluetooth", "airplane", "car", "bus", "train", "boat", "bicycle", "walk",
  "pizza", "cafe", "beer", "wine", "restaurant", "fast-food", "ice-cream",
  "fitness", "football", "basketball", "baseball", "tennisball", "american-football", "golf",
  "gift", "pricetag", "pricetags", "cart", "bag", "wallet", "card", "cash", "receipt",
  "newspaper", "book", "library", "school", "business", "briefcase", "construct", "hammer",
  "attach", "link", "unlink", "print", "save", "exit", "enter", "log-in", "log-out", "power",
];

// 当前图标库的图标列表
const currentIconList = computed(() => {
  const lib = selectedLibrary.value;
  if (lib.startsWith("material")) {
    return materialIconsList.map((name) => ({
      name,
      label: name.replace(/_/g, " "),
    }));
  }
  if (lib === "ionicons") {
    return ioniconsIconsList.map((name) => ({
      name,
      label: name.replace(/-/g, " "),
    }));
  }
  return [];
});

// 过滤后的图标
const filteredIcons = computed(() => {
  let icons = currentIconList.value;
  const lib = selectedLibrary.value;

  // Material 系列添加前缀
  if (lib.startsWith("material") && lib !== "material") {
    const prefix = iconLibraries[lib].prefix;
    icons = icons.map((icon) => ({
      ...icon,
      name: prefix + icon.name,
    }));
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    icons = icons.filter(
      (icon) =>
        icon.name.toLowerCase().includes(query) ||
        icon.label.toLowerCase().includes(query)
    );
  }

  return icons;
});

// 获取 Quasar 使用的图标名称
const getQuasarIconName = (icon) => {
  if (selectedLibrary.value === "ionicons") {
    return `ion-${icon.name}`;
  }
  return icon.name;
};

// 加载图标库 CDN
const loadIconLibrary = async (libKey) => {
  if (loadedLibraries.value.has(libKey)) return;

  const lib = iconLibraries[libKey];
  if (!lib) return;

  loading.value = true;

  try {
    // 加载 CSS
    if (lib.cdnCss) {
      await loadCss(lib.cdnCss);
    }

    // 加载 JS (ESM)
    if (lib.cdn) {
      await loadScript(lib.cdn, libKey);
    }

    loadedLibraries.value.add(libKey);
  } catch (err) {
    console.error(`Failed to load icon library: ${libKey}`, err);
    $q.notify({ type: "negative", message: `加载图标库失败: ${lib.label}` });
  } finally {
    loading.value = false;
  }
};

// 加载 CSS
const loadCss = (url) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${url}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
};

// 加载 Script (ESM)
const loadScript = (url, libKey) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-lib="${libKey}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    script.dataset.lib = libKey;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// 切换图标库时加载
const onLibraryChange = async (libKey) => {
  selectedIcon.value = null;
  await loadIconLibrary(libKey);
};

// 选择图标
const selectIcon = (icon) => {
  selectedIcon.value = icon;
};

// 复制图标名称
const copyIconName = () => {
  if (!selectedIcon.value) return;
  const name = getQuasarIconName(selectedIcon.value);
  copyToClipboard(name);
  $q.notify({ type: "positive", message: `已复制: ${name}` });
};

// 初始化
onMounted(() => {
  // 默认加载 Material Icons（Quasar 默认包含）
});
</script>

<style scoped>
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 4px;
}

.icon-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
}

.icon-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.icon-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.selected-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

/* Ionicons 样式适配 */
ion-icon {
  color: inherit;
}
</style>
