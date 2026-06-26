/**
 * LiteGraph ES6 - Constants and Configuration
 * Refactored from litegraph.js to use ES6 syntax
 */

export const VERSION = 0.4;

// Canvas settings
export const CANVAS_GRID_SIZE = 10;

// Node sizes
export const NODE_TITLE_HEIGHT = 30;
export const NODE_TITLE_TEXT_Y = 20;
export const NODE_SLOT_HEIGHT = 20;
export const NODE_WIDGET_HEIGHT = 20;
export const NODE_WIDTH = 140;
export const NODE_MIN_WIDTH = 50;
export const NODE_COLLAPSED_RADIUS = 10;
export const NODE_COLLAPSED_WIDTH = 80;

// Colors
export const NODE_TITLE_COLOR = "#999";
export const NODE_SELECTED_TITLE_COLOR = "#FFF";
export const NODE_TEXT_SIZE = 14;
export const NODE_TEXT_COLOR = "#AAA";
export const NODE_SUBTEXT_SIZE = 12;
export const NODE_DEFAULT_COLOR = "#333";
export const NODE_DEFAULT_BGCOLOR = "#353535";
export const NODE_DEFAULT_BOXCOLOR = "#666";
export const NODE_DEFAULT_SHAPE = "box";
export const NODE_BOX_OUTLINE_COLOR = "#FFF";
export const DEFAULT_SHADOW_COLOR = "rgba(0,0,0,0.5)";
export const DEFAULT_GROUP_FONT = 24;

// Widget colors
export const WIDGET_BGCOLOR = "#222";
export const WIDGET_OUTLINE_COLOR = "#666";
export const WIDGET_TEXT_COLOR = "#DDD";
export const WIDGET_SECONDARY_TEXT_COLOR = "#999";

// Link colors
export const LINK_COLOR = "#9A9";
export const EVENT_LINK_COLOR = "#A86";
export const CONNECTING_LINK_COLOR = "#AFA";

// Limits
export const MAX_NUMBER_OF_NODES = 1000;
export const DEFAULT_POSITION = [100, 100];

// Shapes
export const VALID_SHAPES = ["default", "box", "round", "card"];
export const BOX_SHAPE = 1;
export const ROUND_SHAPE = 2;
export const CIRCLE_SHAPE = 3;
export const CARD_SHAPE = 4;
export const ARROW_SHAPE = 5;
export const GRID_SHAPE = 6;

// Connection types
export const INPUT = 1;
export const OUTPUT = 2;
export const EVENT = -1;
export const ACTION = -1;

// Node modes
export const NODE_MODES = ["Always", "On Event", "Never", "On Trigger"];
export const NODE_MODES_COLORS = ["#666", "#422", "#333", "#224", "#626"];
export const ALWAYS = 0;
export const ON_EVENT = 1;
export const NEVER = 2;
export const ON_TRIGGER = 3;

// Directions
export const UP = 1;
export const DOWN = 2;
export const LEFT = 3;
export const RIGHT = 4;
export const CENTER = 5;

// Link render modes
export const LINK_RENDER_MODES = ["Straight", "Linear", "Spline"];
export const STRAIGHT_LINK = 0;
export const LINEAR_LINK = 1;
export const SPLINE_LINK = 2;

// Title modes
export const NORMAL_TITLE = 0;
export const NO_TITLE = 1;
export const TRANSPARENT_TITLE = 2;
export const AUTOHIDE_TITLE = 3;
export const VERTICAL_LAYOUT = "vertical";

// Global configuration object
export const LiteGraphConfig = {
  debug: false,
  catch_exceptions: true,
  throw_errors: true,
  allow_scripts: false,
  use_deferred_actions: true,
  registered_node_types: {},
  node_types_by_file_extension: {},
  Nodes: {},
  Globals: {},
  searchbox_extras: {},
  auto_sort_node_types: false,
  node_box_coloured_when_on: false,
  node_box_coloured_by_mode: false,
  dialog_close_on_mouse_leave: true,
  dialog_close_on_mouse_leave_delay: 500,
  shift_click_do_break_link_from: false,
  click_do_break_link_to: false,
  search_hide_on_mouse_leave: true,
  search_filter_enabled: false,
  search_show_all_on_open: true,
  auto_load_slot_types: false,
  registered_slot_in_types: {},
  registered_slot_out_types: {},
  slot_types_in: [],
  slot_types_out: [],
  slot_types_default_in: [],
  slot_types_default_out: [],
  alt_drag_do_clone_nodes: false,
  do_add_triggers_slots: false,
  allow_multi_output_for_events: true,
  middle_click_slot_add_default_node: false,
  release_link_on_empty_shows_menu: false,
  pointerevents_method: "mouse",
  ctrl_shift_v_paste_connect_unselected_outputs: false,
  use_uuids: false,
  proxy: null,
  node_images_path: ""
};

export default {
  VERSION,
  CANVAS_GRID_SIZE,
  NODE_TITLE_HEIGHT,
  NODE_TITLE_TEXT_Y,
  NODE_SLOT_HEIGHT,
  NODE_WIDGET_HEIGHT,
  NODE_WIDTH,
  NODE_MIN_WIDTH,
  NODE_COLLAPSED_RADIUS,
  NODE_COLLAPSED_WIDTH,
  NODE_TITLE_COLOR,
  NODE_SELECTED_TITLE_COLOR,
  NODE_TEXT_SIZE,
  NODE_TEXT_COLOR,
  NODE_SUBTEXT_SIZE,
  NODE_DEFAULT_COLOR,
  NODE_DEFAULT_BGCOLOR,
  NODE_DEFAULT_BOXCOLOR,
  NODE_DEFAULT_SHAPE,
  NODE_BOX_OUTLINE_COLOR,
  DEFAULT_SHADOW_COLOR,
  DEFAULT_GROUP_FONT,
  WIDGET_BGCOLOR,
  WIDGET_OUTLINE_COLOR,
  WIDGET_TEXT_COLOR,
  WIDGET_SECONDARY_TEXT_COLOR,
  LINK_COLOR,
  EVENT_LINK_COLOR,
  CONNECTING_LINK_COLOR,
  MAX_NUMBER_OF_NODES,
  DEFAULT_POSITION,
  VALID_SHAPES,
  BOX_SHAPE,
  ROUND_SHAPE,
  CIRCLE_SHAPE,
  CARD_SHAPE,
  ARROW_SHAPE,
  GRID_SHAPE,
  INPUT,
  OUTPUT,
  EVENT,
  ACTION,
  NODE_MODES,
  NODE_MODES_COLORS,
  ALWAYS,
  ON_EVENT,
  NEVER,
  ON_TRIGGER,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  CENTER,
  LINK_RENDER_MODES,
  STRAIGHT_LINK,
  LINEAR_LINK,
  SPLINE_LINK,
  NORMAL_TITLE,
  NO_TITLE,
  TRANSPARENT_TITLE,
  AUTOHIDE_TITLE,
  VERTICAL_LAYOUT,
  LiteGraphConfig
};
