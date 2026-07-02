import {
  LGraph,
  LGraphCanvas,
  LiteGraph,
  LLink,
  LGraphNode,
  LGraphGroup,
  DragAndScale,
  ContextMenu,
} from "litegraph.js";

LiteGraph.debug = false;
LiteGraph.use_uuids = true;
LiteGraph.NODE_TITLE_HEIGHT = 30;
LiteGraph.NODE_SLOT_HEIGHT = 24;
LiteGraph.use_uuids = true;
LiteGraph.NODE_WIDTH = 180;
LiteGraph.ouptLabelMargin = 50;
LiteGraph.clearRegisteredTypes();

// 配置连接断开行为：允许点击输入槽直接断开连接
LiteGraph.click_do_break_link_to = true;

// 屏蔽双击搜索框事件
LGraphCanvas.prototype.showSearchBox = (e) => {};

const isInsideRectangle = LiteGraph.isInsideRectangle;

var temp_vec2 = new Float32Array(2);

/**
 * process a key event
 * @method processKey
 **/
LGraphCanvas.prototype.processKey = function (e) {
  if (!this.graph) {
    return;
  }

  var block_default = false;
  //console.log(e); //debug

  if (e.target.localName == "input") {
    return;
  }

  if (e.type == "keydown") {
    // ========== 优先级最高：全局快捷键屏蔽 ==========

    // 屏蔽 Ctrl+S / Cmd+S 保存快捷键
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      block_default = true;
    }

    // 屏蔽 Backspace 删除键（防止浏览器后退）
    if (e.key === "Backspace") {
      block_default = true;
    }

    // ========== 画布特定快捷键 ==========

    // Tab 键 - 显示/隐藏节点菜单
    if (e.key === "Tab") {
      if (this.onTabMenu) {
        this.onTabMenu(e);
      }
      block_default = true;
    }

    // Space 键 - 拖拽画布
    if (e.keyCode == 32) {
      //space
      this.dragging_canvas = true;
      block_default = true;
    }

    // Esc 键 - 关闭面板
    if (e.keyCode == 27) {
      //esc
      if (this.node_panel) this.node_panel.close();
      if (this.options_panel) this.options_panel.close();
      block_default = true;
    }

    // Ctrl+A - 全选节点
    if (e.keyCode == 65 && e.ctrlKey) {
      this.selectNodes();
      block_default = true;
    }

    // Ctrl+C - 复制节点
    if (e.keyCode === 67 && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      //copy
      if (this.selected_nodes) {
        this.copyToClipboard();
        block_default = true;
      }
    }

    // Ctrl+V - 粘贴节点
    if (e.keyCode === 86 && (e.metaKey || e.ctrlKey)) {
      //paste
      this.pasteFromClipboard(e.shiftKey);
    }

    // Delete 键 - 删除节点（注意：Backspace 已在上方全局屏蔽）
    if (e.keyCode == 46) {
      if (e.target.localName != "input" && e.target.localName != "textarea") {
        this.deleteSelectedNodes();
        block_default = true;
      }
    }

    //collapse
    //...

    //TODO
    if (this.selected_nodes) {
      for (var i in this.selected_nodes) {
        if (this.selected_nodes[i].onKeyDown) {
          this.selected_nodes[i].onKeyDown(e);
        }
      }
    }
  } else if (e.type == "keyup") {
    if (e.keyCode == 32) {
      // space
      this.dragging_canvas = false;
    }

    if (this.selected_nodes) {
      for (var i in this.selected_nodes) {
        if (this.selected_nodes[i].onKeyUp) {
          this.selected_nodes[i].onKeyUp(e);
        }
      }
    }
  }

  this.graph.change();

  if (block_default) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }
};

// 隐藏Tab菜单
LGraphCanvas.prototype.hideTabMenu = function () {
  if (this.onHideTabMenu) {
    this.onHideTabMenu();
  }
};

LGraphCanvas.prototype.processMouseDown = function (e) {
  if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

  if (!this.graph) {
    return;
  }

  this.adjustMouseEvent(e);

  // 点击时隐藏Tab菜单
  this.hideTabMenu();

  var ref_window = this.getCanvasWindow();
  var document = ref_window.document;
  LGraphCanvas.active_canvas = this;
  var that = this;

  var x = e.clientX;
  var y = e.clientY;

  this.ds.viewport = this.viewport;
  var is_inside =
    !this.viewport ||
    (this.viewport &&
      x >= this.viewport[0] &&
      x < this.viewport[0] + this.viewport[2] &&
      y >= this.viewport[1] &&
      y < this.viewport[1] + this.viewport[3]);

  //move mouse move event to the window in case it drags outside of the canvas
  if (!this.options.skip_events) {
    LiteGraph.pointerListenerRemove(
      this.canvas,
      "move",
      this._mousemove_callback,
    );
    LiteGraph.pointerListenerAdd(
      ref_window.document,
      "move",
      this._mousemove_callback,
      true,
    ); //catch for the entire window
    LiteGraph.pointerListenerAdd(
      ref_window.document,
      "up",
      this._mouseup_callback,
      true,
    );
  }

  if (!is_inside) {
    return;
  }

  var node = this.graph.getNodeOnPos(
    e.canvasX,
    e.canvasY,
    this.visible_nodes,
    5,
  );
  var skip_dragging = false;
  var skip_action = false;
  var now = LiteGraph.getTime();
  var is_primary = e.isPrimary === undefined || !e.isPrimary;
  var is_double_click = now - this.last_mouseclick < 300 && is_primary;
  this.mouse[0] = e.clientX;
  this.mouse[1] = e.clientY;
  this.graph_mouse[0] = e.canvasX;
  this.graph_mouse[1] = e.canvasY;
  this.last_click_position = [this.mouse[0], this.mouse[1]];

  if (this.pointer_is_down && is_primary) {
    this.pointer_is_double = true;
  } else {
    this.pointer_is_double = false;
  }
  this.pointer_is_down = true;

  this.canvas.focus();

  LiteGraph.closeAllContextMenus(ref_window);

  if (this.onMouse) {
    if (this.onMouse(e) == true) return;
  }

  //left button mouse / single finger
  if (e.which == 1 && !this.pointer_is_double) {
    // 先不在这里启动框选，等确定没有点击到节点和group后再启动

    // clone node ALT dragging
    if (
      LiteGraph.alt_drag_do_clone_nodes &&
      e.altKey &&
      node &&
      this.allow_interaction &&
      !skip_action &&
      !this.read_only
    ) {
      if ((cloned = node.clone())) {
        cloned.pos[0] += 5;
        cloned.pos[1] += 5;
        this.graph.add(cloned, false, { doCalcSize: false });
        node = cloned;
        skip_action = true;
        if (!block_drag_node) {
          if (this.allow_dragnodes) {
            this.graph.beforeChange();
            this.node_dragged = node;
          }
          if (!this.selected_nodes[node.id]) {
            this.processNodeSelected(node, e);
          }
        }
      }
    }

    var clicking_canvas_bg = false;

    //when clicked on top of a node
    //and it is not interactive
    if (
      node &&
      (this.allow_interaction || node.flags.allow_interaction) &&
      !skip_action &&
      !this.read_only
    ) {
      if (!this.live_mode && !node.flags.pinned) {
        this.bringToFront(node);
      } //if it wasn't selected?

      //not dragging mouse to connect two slots
      if (
        this.allow_interaction &&
        !this.connecting_node &&
        !node.flags.collapsed &&
        !this.live_mode
      ) {
        //Search for corner for resize
        if (
          !skip_action &&
          node.resizable !== false &&
          isInsideRectangle(
            e.canvasX,
            e.canvasY,
            node.pos[0] + node.size[0] - 5,
            node.pos[1] + node.size[1] - 5,
            10,
            10,
          )
        ) {
          this.graph.beforeChange();
          this.resizing_node = node;
          this.canvas.style.cursor = "se-resize";
          skip_action = true;
        } else {
          //search for outputs
          if (node.outputs) {
            for (var i = 0, l = node.outputs.length; i < l; ++i) {
              var output = node.outputs[i];
              var link_pos = node.getConnectionPos(false, i);
              if (
                isInsideRectangle(
                  e.canvasX,
                  e.canvasY,
                  link_pos[0] - 15,
                  link_pos[1] - 10,
                  30,
                  20,
                )
              ) {
                this.connecting_node = node;
                this.connecting_output = output;
                this.connecting_output.slot_index = i;
                this.connecting_pos = node.getConnectionPos(false, i);
                this.connecting_slot = i;

                if (LiteGraph.shift_click_do_break_link_from) {
                  if (e.shiftKey) {
                    node.disconnectOutput(i);
                  }
                }

                if (is_double_click) {
                  if (node.onOutputDblClick) {
                    node.onOutputDblClick(i, e);
                  }
                } else {
                  if (node.onOutputClick) {
                    node.onOutputClick(i, e);
                  }
                }

                skip_action = true;
                break;
              }
            }
          }

          //search for inputs
          if (node.inputs) {
            for (var i = 0, l = node.inputs.length; i < l; ++i) {
              var input = node.inputs[i];
              var link_pos = node.getConnectionPos(true, i);
              if (
                isInsideRectangle(
                  e.canvasX,
                  e.canvasY,
                  link_pos[0] - 15,
                  link_pos[1] - 10,
                  30,
                  20,
                )
              ) {
                if (is_double_click) {
                  if (node.onInputDblClick) {
                    node.onInputDblClick(i, e);
                  }
                } else {
                  if (node.onInputClick) {
                    node.onInputClick(i, e);
                  }
                }

                if (input.link !== null) {
                  var link_info = this.graph.links[input.link]; //before disconnecting
                  if (LiteGraph.click_do_break_link_to) {
                    node.disconnectInput(i);
                    this.dirty_bgcanvas = true;
                    skip_action = true;
                  } else {
                    // do same action as has not node ?
                  }

                  if (
                    this.allow_reconnect_links ||
                    //this.move_destination_link_without_shift ||
                    e.shiftKey
                  ) {
                    if (!LiteGraph.click_do_break_link_to) {
                      node.disconnectInput(i);
                    }
                    this.connecting_node =
                      this.graph._nodes_by_id[link_info.origin_id];
                    this.connecting_slot = link_info.origin_slot;
                    this.connecting_output =
                      this.connecting_node.outputs[this.connecting_slot];
                    this.connecting_pos = this.connecting_node.getConnectionPos(
                      false,
                      this.connecting_slot,
                    );

                    this.dirty_bgcanvas = true;
                    skip_action = true;
                  }
                } else {
                  // has not node
                }

                if (!skip_action) {
                  // connect from in to out, from to to from
                  this.connecting_node = node;
                  this.connecting_input = input;
                  this.connecting_input.slot_index = i;
                  this.connecting_pos = node.getConnectionPos(true, i);
                  this.connecting_slot = i;

                  this.dirty_bgcanvas = true;
                  skip_action = true;
                }
              }
            }
          }
        } //not resizing
      }

      //it wasn't clicked on the links boxes
      if (!skip_action) {
        var block_drag_node = false;
        var pos = [e.canvasX - node.pos[0], e.canvasY - node.pos[1]];

        //widgets
        var widget = this.processNodeWidgets(node, this.graph_mouse, e);
        if (widget) {
          block_drag_node = true;
          this.node_widget = [node, widget];
        }

        //double clicking
        if (
          this.allow_interaction &&
          is_double_click &&
          this.selected_nodes[node.id]
        ) {
          //double click node
          if (node.onDblClick) {
            node.onDblClick(e, pos, this);
          }
          this.processNodeDblClicked(node);
          block_drag_node = true;
        }

        //if do not capture mouse
        if (node.onMouseDown && node.onMouseDown(e, pos, this)) {
          block_drag_node = true;
        } else {
          //open subgraph button
          if (node.subgraph && !node.skip_subgraph_button) {
            if (
              !node.flags.collapsed &&
              pos[0] > node.size[0] - LiteGraph.NODE_TITLE_HEIGHT &&
              pos[1] < 0
            ) {
              var that = this;
              setTimeout(function () {
                that.openSubgraph(node.subgraph);
              }, 10);
            }
          }

          if (this.live_mode) {
            clicking_canvas_bg = true;
            block_drag_node = true;
          }
        }

        if (!block_drag_node) {
          if (this.allow_dragnodes) {
            this.graph.beforeChange();
            this.node_dragged = node;
          }
          // 如果节点已经被选中且没有按 Shift 键，不要重新选择（保持多选状态）
          // 只有在节点未被选中或按了 Shift 键时才调用 processNodeSelected
          if (!node.is_selected || e.shiftKey) {
            this.processNodeSelected(node, e);
          }
        } else {
          // double-click
          /**
           * Don't call the function if the block is already selected.
           * Otherwise, it could cause the block to be unselected while its panel is open.
           */
          if (!node.is_selected) this.processNodeSelected(node, e);
        }

        this.dirty_canvas = true;
      }
    } //clicked outside of nodes
    else {
      if (!skip_action) {
        //search for link connector
        if (!this.read_only) {
          for (var i = 0; i < this.visible_links.length; ++i) {
            var link = this.visible_links[i];
            var center = link._pos;
            if (
              !center ||
              e.canvasX < center[0] - 4 ||
              e.canvasX > center[0] + 4 ||
              e.canvasY < center[1] - 4 ||
              e.canvasY > center[1] + 4
            ) {
              continue;
            }
            //link clicked
            this.showLinkMenu(link, e);
            this.over_link_center = null; //clear tooltip
            break;
          }
        }

        this.selected_group = this.graph.getGroupOnPos(e.canvasX, e.canvasY);
        this.selected_group_resizing = false;
        if (this.selected_group && !this.read_only) {
          // 如果点击到 group，则不启动框选，而是处理 group 的交互

          var dist = distance(
            [e.canvasX, e.canvasY],
            [
              this.selected_group.pos[0] + this.selected_group.size[0],
              this.selected_group.pos[1] + this.selected_group.size[1],
            ],
          );
          if (dist * this.ds.scale < 10) {
            this.selected_group_resizing = true;
          } else {
            this.selected_group.recomputeInsideNodes();
          }
        } else {
          // 没有点击到节点、链接或 group，启动框选
          this.dragging_rectangle = new Float32Array(4);
          this.dragging_rectangle[0] = e.canvasX;
          this.dragging_rectangle[1] = e.canvasY;
          this.dragging_rectangle[2] = 1;
          this.dragging_rectangle[3] = 1;
        }

        if (is_double_click && !this.read_only && this.allow_searchbox) {
          this.showSearchBox(e);
          e.preventDefault();
          e.stopPropagation();
        }

        clicking_canvas_bg = true;
      }
    }
  } else if (e.which == 2) {
    //middle button

    if (LiteGraph.middle_click_slot_add_default_node) {
      if (node && this.allow_interaction && !skip_action && !this.read_only) {
        //not dragging mouse to connect two slots
        if (!this.connecting_node && !node.flags.collapsed && !this.live_mode) {
          var mClikSlot = false;
          var mClikSlot_index = false;
          var mClikSlot_isOut = false;
          //search for outputs
          if (node.outputs) {
            for (var i = 0, l = node.outputs.length; i < l; ++i) {
              var output = node.outputs[i];
              var link_pos = node.getConnectionPos(false, i);
              if (
                isInsideRectangle(
                  e.canvasX,
                  e.canvasY,
                  link_pos[0] - 15,
                  link_pos[1] - 10,
                  30,
                  20,
                )
              ) {
                mClikSlot = output;
                mClikSlot_index = i;
                mClikSlot_isOut = true;
                break;
              }
            }
          }

          //search for inputs
          if (node.inputs) {
            for (var i = 0, l = node.inputs.length; i < l; ++i) {
              var input = node.inputs[i];
              var link_pos = node.getConnectionPos(true, i);
              if (
                isInsideRectangle(
                  e.canvasX,
                  e.canvasY,
                  link_pos[0] - 15,
                  link_pos[1] - 10,
                  30,
                  20,
                )
              ) {
                mClikSlot = input;
                mClikSlot_index = i;
                mClikSlot_isOut = false;
                break;
              }
            }
          }
          //console.log("middleClickSlots? "+mClikSlot+" & "+(mClikSlot_index!==false));
          if (mClikSlot && mClikSlot_index !== false) {
            var alphaPosY =
              0.5 -
              (mClikSlot_index + 1) /
                (mClikSlot_isOut ? node.outputs.length : node.inputs.length);
            var node_bounding = node.getBounding();
            // estimate a position: this is a bad semi-bad-working mess .. REFACTOR with a correct autoplacement that knows about the others slots and nodes
            var posRef = [
              !mClikSlot_isOut
                ? node_bounding[0]
                : node_bounding[0] + node_bounding[2], // + node_bounding[0]/this.canvas.width*150
              e.canvasY - 80, // + node_bounding[0]/this.canvas.width*66 // vertical "derive"
            ];
            var nodeCreated = this.createDefaultNodeForSlot({
              nodeFrom: !mClikSlot_isOut ? null : node,
              slotFrom: !mClikSlot_isOut ? null : mClikSlot_index,
              nodeTo: !mClikSlot_isOut ? node : null,
              slotTo: !mClikSlot_isOut ? mClikSlot_index : null,
              position: posRef, //,e: e
              nodeType: "AUTO", //nodeNewType
              posAdd: [!mClikSlot_isOut ? -30 : 30, -alphaPosY * 130], //-alphaPosY*30]
              posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0], //-alphaPosY*2*/
            });
          }
        }
      }
    } else if (!skip_action && this.allow_dragcanvas) {
      //console.log("pointerevents: dragging_canvas start from middle button");
      this.dragging_canvas = true;
    }
  } else if (e.which == 3 || this.pointer_is_double) {
    //right button - 改为拖动画布而不是显示菜单
    if (this.allow_dragcanvas && !skip_action) {
      this.dragging_canvas = true;
    }
  }

  this.last_mouse[0] = e.clientX;
  this.last_mouse[1] = e.clientY;
  this.last_mouseclick = LiteGraph.getTime();
  this.last_mouse_dragging = true;

  this.graph.change();

  //this is to ensure to defocus(blur) if a text input element is on focus
  if (
    !ref_window.document.activeElement ||
    (ref_window.document.activeElement.nodeName.toLowerCase() != "input" &&
      ref_window.document.activeElement.nodeName.toLowerCase() != "textarea")
  ) {
    e.preventDefault();
  }
  e.stopPropagation();

  if (this.onMouseDown) {
    this.onMouseDown(e);
  }

  return false;
};

/**
 * Called when a mouse move event has to be processed
 * @method processMouseMove
 **/
LGraphCanvas.prototype.processMouseMove = function (e) {
  if (this.autoresize) {
    this.resize();
  }

  if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

  if (!this.graph) {
    return;
  }

  LGraphCanvas.active_canvas = this;
  this.adjustMouseEvent(e);
  var mouse = [e.clientX, e.clientY];
  this.mouse[0] = mouse[0];
  this.mouse[1] = mouse[1];
  var delta = [mouse[0] - this.last_mouse[0], mouse[1] - this.last_mouse[1]];
  this.last_mouse = mouse;
  this.graph_mouse[0] = e.canvasX;
  this.graph_mouse[1] = e.canvasY;

  //console.log("pointerevents: processMouseMove "+e.pointerId+" "+e.isPrimary);

  if (this.block_click) {
    //console.log("pointerevents: processMouseMove block_click");
    e.preventDefault();
    return false;
  }

  e.dragging = this.last_mouse_dragging;

  if (this.node_widget) {
    this.processNodeWidgets(
      this.node_widget[0],
      this.graph_mouse,
      e,
      this.node_widget[1],
    );
    this.dirty_canvas = true;
  }

  //get node over
  var node = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

  if (this.dragging_rectangle) {
    this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
    this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
    this.dirty_canvas = true;
  } else if (this.selected_group && !this.read_only) {
    //moving/resizing a group
    if (this.selected_group_resizing) {
      this.selected_group.size = [
        e.canvasX - this.selected_group.pos[0],
        e.canvasY - this.selected_group.pos[1],
      ];
    } else {
      var deltax = delta[0] / this.ds.scale;
      var deltay = delta[1] / this.ds.scale;
      this.selected_group.move(deltax, deltay, e.ctrlKey);
      if (this.selected_group._nodes.length) {
        this.dirty_canvas = true;
      }
    }
    this.dirty_bgcanvas = true;
  } else if (this.dragging_canvas) {
    ////console.log("pointerevents: processMouseMove is dragging_canvas");
    this.ds.offset[0] += delta[0] / this.ds.scale;
    this.ds.offset[1] += delta[1] / this.ds.scale;
    this.dirty_canvas = true;
    this.dirty_bgcanvas = true;
  } else if (
    (this.allow_interaction || (node && node.flags.allow_interaction)) &&
    !this.read_only
  ) {
    if (this.connecting_node) {
      this.dirty_canvas = true;
    }

    //remove mouseover flag
    for (var i = 0, l = this.graph._nodes.length; i < l; ++i) {
      if (this.graph._nodes[i].mouseOver && node != this.graph._nodes[i]) {
        //mouse leave
        this.graph._nodes[i].mouseOver = false;
        if (this.node_over && this.node_over.onMouseLeave) {
          this.node_over.onMouseLeave(e);
        }
        this.node_over = null;
        this.dirty_canvas = true;
      }
    }

    //mouse over a node
    if (node) {
      if (node.redraw_on_mouse) this.dirty_canvas = true;

      //this.canvas.style.cursor = "move";
      if (!node.mouseOver) {
        //mouse enter
        node.mouseOver = true;
        this.node_over = node;
        this.dirty_canvas = true;

        if (node.onMouseEnter) {
          node.onMouseEnter(e);
        }
      }

      //in case the node wants to do something
      if (node.onMouseMove) {
        node.onMouseMove(
          e,
          [e.canvasX - node.pos[0], e.canvasY - node.pos[1]],
          this,
        );
      }

      //if dragging a link
      if (this.connecting_node) {
        if (this.connecting_output) {
          var pos = this._highlight_input || [0, 0]; //to store the output of isOverNodeInput

          //on top of input
          if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
            //mouse on top of the corner box, don't know what to do
          } else {
            //check if I have a slot below de mouse
            var slot = this.isOverNodeInput(node, e.canvasX, e.canvasY, pos);
            if (slot != -1 && node.inputs[slot]) {
              var slot_type = node.inputs[slot].type;
              if (
                LiteGraph.isValidConnection(
                  this.connecting_output.type,
                  slot_type,
                )
              ) {
                this._highlight_input = pos;
                this._highlight_input_slot = node.inputs[slot]; // XXX CHECK THIS
              }
            } else {
              this._highlight_input = null;
              this._highlight_input_slot = null; // XXX CHECK THIS
            }
          }
        } else if (this.connecting_input) {
          var pos = this._highlight_output || [0, 0]; //to store the output of isOverNodeOutput

          //on top of output
          if (this.isOverNodeBox(node, e.canvasX, e.canvasY)) {
            //mouse on top of the corner box, don't know what to do
          } else {
            //check if I have a slot below de mouse
            var slot = this.isOverNodeOutput(node, e.canvasX, e.canvasY, pos);
            if (slot != -1 && node.outputs[slot]) {
              var slot_type = node.outputs[slot].type;
              if (
                LiteGraph.isValidConnection(
                  this.connecting_input.type,
                  slot_type,
                )
              ) {
                this._highlight_output = pos;
              }
            } else {
              this._highlight_output = null;
            }
          }
        }
      }

      //Search for corner
      if (this.canvas) {
        if (
          isInsideRectangle(
            e.canvasX,
            e.canvasY,
            node.pos[0] + node.size[0] - 5,
            node.pos[1] + node.size[1] - 5,
            5,
            5,
          )
        ) {
          this.canvas.style.cursor = "se-resize";
        } else {
          this.canvas.style.cursor = "pointer"; // 鼠标在节点上时显示手型
        }
      }
    } else {
      //not over a node

      //search for link connector
      var over_link = null;
      for (var i = 0; i < this.visible_links.length; ++i) {
        var link = this.visible_links[i];
        var center = link._pos;
        if (
          !center ||
          e.canvasX < center[0] - 4 ||
          e.canvasX > center[0] + 4 ||
          e.canvasY < center[1] - 4 ||
          e.canvasY > center[1] + 4
        ) {
          continue;
        }
        over_link = link;
        break;
      }
      if (over_link != this.over_link_center) {
        this.over_link_center = over_link;
        this.dirty_canvas = true;
      }

      if (this.canvas) {
        this.canvas.style.cursor = ""; // 恢复默认光标
      }
    } //end

    //send event to node if capturing input (used with widgets that allow drag outside of the area of the node)
    if (
      this.node_capturing_input &&
      this.node_capturing_input != node &&
      this.node_capturing_input.onMouseMove
    ) {
      this.node_capturing_input.onMouseMove(
        e,
        [
          e.canvasX - this.node_capturing_input.pos[0],
          e.canvasY - this.node_capturing_input.pos[1],
        ],
        this,
      );
    }

    //node being dragged
    if (this.node_dragged && !this.live_mode) {
      for (var i in this.selected_nodes) {
        var n = this.selected_nodes[i];
        n.pos[0] += delta[0] / this.ds.scale;
        n.pos[1] += delta[1] / this.ds.scale;
        if (!n.is_selected) this.processNodeSelected(n, e); /*
         * Don't call the function if the block is already selected.
         * Otherwise, it could cause the block to be unselected while dragging.
         */
      }

      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
    }

    if (this.resizing_node && !this.live_mode) {
      //convert mouse to node space
      var desired_size = [
        e.canvasX - this.resizing_node.pos[0],
        e.canvasY - this.resizing_node.pos[1],
      ];
      var min_size = this.resizing_node.computeSize();
      desired_size[0] = Math.max(min_size[0], desired_size[0]);
      desired_size[1] = Math.max(min_size[1], desired_size[1]);
      this.resizing_node.setSize(desired_size);

      this.canvas.style.cursor = "se-resize";
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
    }
  }

  e.preventDefault();
  return false;
};

/**
 * Called when a mouse up event has to be processed
 * @method processMouseUp
 **/
LGraphCanvas.prototype.processMouseUp = function (e) {
  var is_primary = e.isPrimary === undefined || e.isPrimary;

  //early exit for extra pointer
  if (!is_primary) {
    /*e.stopPropagation();
        e.preventDefault();*/
    //console.log("pointerevents: processMouseUp pointerN_stop "+e.pointerId+" "+e.isPrimary);
    return false;
  }

  if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

  if (!this.graph) return;

  var window = this.getCanvasWindow();
  var document = window.document;
  LGraphCanvas.active_canvas = this;

  //restore the mousemove event back to the canvas
  if (!this.options.skip_events) {
    LiteGraph.pointerListenerRemove(
      document,
      "move",
      this._mousemove_callback,
      true,
    );
    LiteGraph.pointerListenerAdd(
      this.canvas,
      "move",
      this._mousemove_callback,
      true,
    );
    LiteGraph.pointerListenerRemove(
      document,
      "up",
      this._mouseup_callback,
      true,
    );
  }

  this.adjustMouseEvent(e);
  var now = LiteGraph.getTime();
  e.click_time = now - this.last_mouseclick;
  this.last_mouse_dragging = false;
  this.last_click_position = null;

  if (this.block_click) {
    this.block_click = false; //used to avoid sending twice a click in a immediate button
  }

  if (e.which == 1) {
    if (this.node_widget) {
      this.processNodeWidgets(this.node_widget[0], this.graph_mouse, e);
    }

    //left button
    this.node_widget = null;

    if (this.selected_group) {
      var diffx =
        this.selected_group.pos[0] - Math.round(this.selected_group.pos[0]);
      var diffy =
        this.selected_group.pos[1] - Math.round(this.selected_group.pos[1]);
      this.selected_group.move(diffx, diffy, e.ctrlKey);
      this.selected_group.pos[0] = Math.round(this.selected_group.pos[0]);
      this.selected_group.pos[1] = Math.round(this.selected_group.pos[1]);
      if (this.selected_group._nodes.length) {
        this.dirty_canvas = true;
      }
      this.selected_group = null;
    }
    this.selected_group_resizing = false;

    var node = this.graph.getNodeOnPos(
      e.canvasX,
      e.canvasY,
      this.visible_nodes,
    );

    if (this.dragging_rectangle) {
      if (this.graph) {
        var nodes = this.graph._nodes;
        var node_bounding = new Float32Array(4);

        //compute bounding and flip if left to right
        var w = Math.abs(this.dragging_rectangle[2]);
        var h = Math.abs(this.dragging_rectangle[3]);
        var startx =
          this.dragging_rectangle[2] < 0
            ? this.dragging_rectangle[0] - w
            : this.dragging_rectangle[0];
        var starty =
          this.dragging_rectangle[3] < 0
            ? this.dragging_rectangle[1] - h
            : this.dragging_rectangle[1];
        this.dragging_rectangle[0] = startx;
        this.dragging_rectangle[1] = starty;
        this.dragging_rectangle[2] = w;
        this.dragging_rectangle[3] = h;

        // test dragging rect size, if minimun simulate a click
        if (!node || (w > 10 && h > 10)) {
          //test against all nodes (not visible because the rectangle maybe start outside
          var to_select = [];
          for (var i = 0; i < nodes.length; ++i) {
            var nodeX = nodes[i];
            nodeX.getBounding(node_bounding);
            if (!overlapBounding(this.dragging_rectangle, node_bounding)) {
              continue;
            } //out of the visible area
            to_select.push(nodeX);
          }
          if (to_select.length) {
            this.selectNodes(to_select, e.shiftKey); // Shift 添加到选择
          } else if (!e.shiftKey) {
            // 框选区域没有节点，且没有按 Shift 键，取消所有选择
            this.deselectAllNodes();
          }
        } else {
          // 框选区域太小，按单击处理
          if (node) {
            // 点击到了节点
            this.selectNodes([node], e.shiftKey); // Shift 添加到选择
          } else if (!e.shiftKey) {
            // 点击空白处，取消所有选择
            this.deselectAllNodes();
          }
        }
      }
      this.dragging_rectangle = null;

      // 空白处单击(非框选)补发画布点击回调:用于在右侧属性面板显示画布/组件配置。
      // litegraph 原生 onCanvasClicked 仅在下方"无拖拽" else 分支调用,但空白单击在
      // processMouseDown 阶段已创建 dragging_rectangle,mouseup 必走本分支,原 else 永不可达。
      // 仅当确为单击(矩形极小)且落在空白处时补发,避免误触框选/拖拽。
      if (!node && w < 10 && h < 10 && e.click_time < 300 && this.onCanvasClicked) {
        this.onCanvasClicked(e);
      }
    } else if (this.connecting_node) {
      //dragging a connection
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;

      var connInOrOut = this.connecting_output || this.connecting_input;
      var connType = connInOrOut.type;

      //node below mouse
      if (node) {
        /* no need to condition on event type.. just another type
                  if (
                      connType == LiteGraph.EVENT &&
                      this.isOverNodeBox(node, e.canvasX, e.canvasY)
                  ) {

                      this.connecting_node.connect(
                          this.connecting_slot,
                          node,
                          LiteGraph.EVENT
                      );

                  } else {*/

        //slot below mouse? connect

        if (this.connecting_output) {
          var slot = this.isOverNodeInput(node, e.canvasX, e.canvasY);
          if (slot != -1) {
            this.connecting_node.connect(this.connecting_slot, node, slot);
          } else {
            //not on top of an input
            // look for a good slot
            this.connecting_node.connectByType(
              this.connecting_slot,
              node,
              connType,
            );
          }
        } else if (this.connecting_input) {
          var slot = this.isOverNodeOutput(node, e.canvasX, e.canvasY);

          if (slot != -1) {
            node.connect(slot, this.connecting_node, this.connecting_slot); // this is inverted has output-input nature like
          } else {
            //not on top of an input
            // look for a good slot
            this.connecting_node.connectByTypeOutput(
              this.connecting_slot,
              node,
              connType,
            );
          }
        }

        //}
      } else {
        // add menu when releasing link in empty space
        if (LiteGraph.release_link_on_empty_shows_menu) {
          if (e.shiftKey && this.allow_searchbox) {
            if (this.connecting_output) {
              this.showSearchBox(e, {
                node_from: this.connecting_node,
                slot_from: this.connecting_output,
                type_filter_in: this.connecting_output.type,
              });
            } else if (this.connecting_input) {
              this.showSearchBox(e, {
                node_to: this.connecting_node,
                slot_from: this.connecting_input,
                type_filter_out: this.connecting_input.type,
              });
            }
          } else {
            if (this.connecting_output) {
              this.showConnectionMenu({
                nodeFrom: this.connecting_node,
                slotFrom: this.connecting_output,
                e: e,
              });
            } else if (this.connecting_input) {
              this.showConnectionMenu({
                nodeTo: this.connecting_node,
                slotTo: this.connecting_input,
                e: e,
              });
            }
          }
        }
      }

      this.connecting_output = null;
      this.connecting_input = null;
      this.connecting_pos = null;
      this.connecting_node = null;
      this.connecting_slot = -1;
    } //not dragging connection
    else if (this.resizing_node) {
      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
      this.graph.afterChange(this.resizing_node);
      this.resizing_node = null;
    } else if (this.node_dragged) {
      //node being dragged?
      var node = this.node_dragged;
      if (
        node &&
        e.click_time < 300 &&
        isInsideRectangle(
          e.canvasX,
          e.canvasY,
          node.pos[0],
          node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
          LiteGraph.NODE_TITLE_HEIGHT,
          LiteGraph.NODE_TITLE_HEIGHT,
        )
      ) {
        node.collapse();
      }

      this.dirty_canvas = true;
      this.dirty_bgcanvas = true;
      this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
      this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
      if (this.graph.config.align_to_grid || this.align_to_grid) {
        this.node_dragged.alignToGrid();
      }
      if (this.onNodeMoved) this.onNodeMoved(this.node_dragged);
      this.graph.afterChange(this.node_dragged);
      this.node_dragged = null;
    } //no node being dragged
    else {
      //get node over
      var node = this.graph.getNodeOnPos(
        e.canvasX,
        e.canvasY,
        this.visible_nodes,
      );

      if (!node && e.click_time < 300) {
        // 点击空白处且没有按 Shift 键，取消所有选择
        if (!e.shiftKey) {
          this.deselectAllNodes();
        }

        // 触发画布点击回调
        if (this.onCanvasClicked) {
          this.onCanvasClicked(e);
        }
      }

      this.dirty_canvas = true;
      this.dragging_canvas = false;

      if (this.node_over && this.node_over.onMouseUp) {
        this.node_over.onMouseUp(
          e,
          [
            e.canvasX - this.node_over.pos[0],
            e.canvasY - this.node_over.pos[1],
          ],
          this,
        );
      }
      if (this.node_capturing_input && this.node_capturing_input.onMouseUp) {
        this.node_capturing_input.onMouseUp(e, [
          e.canvasX - this.node_capturing_input.pos[0],
          e.canvasY - this.node_capturing_input.pos[1],
        ]);
      }
    }
  } else if (e.which == 2) {
    //middle button
    //trace("middle");
    this.dirty_canvas = true;
    this.dragging_canvas = false;
  } else if (e.which == 3) {
    //right button - 结束右键拖动画布
    this.dirty_canvas = true;
    this.dragging_canvas = false;
  }

  /*
  if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
    this.draw();
  */

  if (is_primary) {
    this.pointer_is_down = false;
    this.pointer_is_double = false;
  }

  this.graph.change();

  //console.log("pointerevents: processMouseUp stopPropagation");
  e.stopPropagation();
  e.preventDefault();
  return false;
};

/**
 * Called when a mouse wheel event has to be processed
 * @method processMouseWheel
 **/
LGraphCanvas.prototype.processMouseWheel = function (e) {
  if (!this.graph || !this.allow_dragcanvas) {
    return;
  }

  var delta = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;

  this.adjustMouseEvent(e);

  var x = e.clientX;
  var y = e.clientY;
  var is_inside =
    !this.viewport ||
    (this.viewport &&
      x >= this.viewport[0] &&
      x < this.viewport[0] + this.viewport[2] &&
      y >= this.viewport[1] &&
      y < this.viewport[1] + this.viewport[3]);
  if (!is_inside) return;

  var scale = this.ds.scale;

  if (delta > 0) {
    scale *= 1.4;
  } else if (delta < 0) {
    scale *= 1 / 1.4;
  }

  // 使用canvas相对坐标而不是client坐标
  // 获取canvas的边界矩形
  var rect = this.canvas.getBoundingClientRect();
  var zoom_center = [e.clientX - rect.left, e.clientY - rect.top];

  this.ds.changeScale(scale, zoom_center);

  this.graph.change();

  e.preventDefault();
  return false; // prevent default
};

/**
 * returns true if a position (in graph space) is on top of a node little corner box
 * @method isOverNodeBox
 **/
LGraphCanvas.prototype.isOverNodeBox = function (node, canvasx, canvasy) {
  var title_height = LiteGraph.NODE_TITLE_HEIGHT;
  if (
    isInsideRectangle(
      canvasx,
      canvasy,
      node.pos[0] + 2,
      node.pos[1] + 2 - title_height,
      title_height - 4,
      title_height - 4,
    )
  ) {
    return true;
  }
  return false;
};

// subgraph 内部 属性界面
LGraphCanvas.prototype.drawSubgraphPanelLeft = function (
  subgraph,
  subnode,
  ctx,
) {
  var num = subnode.inputs
    ? subnode.inputs.filter((input) => !input.hideOnSubgraphPanel).length
    : 0;
  var w = 200;
  var h = Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.6);

  ctx.fillStyle = "#111";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.roundRect(10, 10, w, (num + 1) * h + 10, [8]);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#888";
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Graph Inputs", 20, 34);
  // var pos = this.mouse;

  if (this.drawButton(w - 20, 20, 20, 20, "X", "#151515")) {
    this.closeSubgraph();
    return;
  }

  var y = 50;
  ctx.font = "14px Arial";
  if (subnode.inputs)
    for (var i = 0; i < subnode.inputs.length; ++i) {
      var input = subnode.inputs[i];
      if (input.hideOnSubgraphPanel) continue;

      //input button clicked
      if (this.drawButton(20, y + 2, w - 20, h - 2)) {
        var type = subnode.constructor.input_node_type || "graph/input";
        this.graph.beforeChange();
        var newnode = LiteGraph.createNode(type);
        if (newnode) {
          subgraph.add(newnode);
          this.block_click = false;
          this.last_click_position = null;
          this.selectNodes([newnode]);
          this.node_dragged = newnode;
          this.dragging_canvas = false;

          const key = input.id || input.name;
          subgraph.inputs[key] = input;

          newnode.setProperty("slotId", key);

          this.node_dragged.pos[0] = this.graph_mouse[0] - 5;
          this.node_dragged.pos[1] = this.graph_mouse[1] - 5;
          this.graph.afterChange();
        } else console.error("graph input node not found:", type);
      }
      ctx.fillStyle = "#9C9";
      ctx.beginPath();
      ctx.arc(w - 16, y + h * 0.5, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#AAA";
      ctx.fillText(input.name, 30, y + h * 0.75);

      y += h;
    }
};

LGraphCanvas.prototype.drawSubgraphPanelRight = function (
  subgraph,
  subnode,
  ctx,
) {
  var num = subnode.outputs
    ? subnode.outputs.filter(
        (output) => !(output.hideOnSubgraphPanel || output.hideOnNode),
      ).length
    : 0;
  var canvas_w = this.bgcanvas.width;
  var w = 200;
  var h = Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.6);

  ctx.fillStyle = "#111";
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.roundRect(canvas_w - w - 10, 10, w, (num + 1) * h + 10, [8]);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#888";
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  var title_text = "Graph Outputs";
  var tw = ctx.measureText(title_text).width;
  ctx.fillText(title_text, canvas_w - tw - 20, 34);
  // var pos = this.mouse;
  if (this.drawButton(canvas_w - w, 20, 20, 20, "X", "#151515")) {
    this.closeSubgraph();
    return;
  }

  var y = 50;
  ctx.font = "14px Arial";
  if (subnode.outputs)
    for (var i = 0; i < subnode.outputs.length; ++i) {
      var output = subnode.outputs[i];
      if (output.hideOnSubgraphPanel || output.hideOnNode) continue;

      //output button clicked
      if (this.drawButton(canvas_w - w, y + 2, w - 20, h - 2)) {
        var type = subnode.constructor.output_node_type || "graph/output";

        this.graph.beforeChange();
        var newnode = LiteGraph.createNode(type);
        if (newnode) {
          subgraph.add(newnode);
          this.block_click = false;
          this.last_click_position = null;
          this.selectNodes([newnode]);
          this.node_dragged = newnode;
          this.dragging_canvas = false;
          subgraph.outputs[output.id] = output;

          newnode.setProperty("slotId", output.id);
          this.node_dragged.pos[0] = this.graph_mouse[0] - 5;
          this.node_dragged.pos[1] = this.graph_mouse[1] - 5;
          this.graph.afterChange();
        } else console.error("graph input node not found:", type);
      }
      ctx.fillStyle = "#9C9";
      ctx.beginPath();
      ctx.arc(canvas_w - w + 16, y + h * 0.5, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#AAA";
      ctx.fillText(output.name, canvas_w - w + 30, y + h * 0.75);

      y += h;
    }
};

// node 界面构造

// 节点隐藏支持:flags.hidden 的节点既不渲染也不参与点击命中
// (visible_nodes 同时驱动渲染和 getNodeOnPos)。代码生成走全量 graph._nodes,
// 不依赖 visible_nodes,故隐藏纯属画布层,不影响产物。
const _origComputeVisibleNodes = LGraphCanvas.prototype.computeVisibleNodes;
LGraphCanvas.prototype.computeVisibleNodes = function (nodes, out) {
  const visible = _origComputeVisibleNodes.call(this, nodes, out);
  for (let i = visible.length - 1; i >= 0; i--) {
    if (visible[i] && visible[i].flags && visible[i].flags.hidden) {
      visible.splice(i, 1);
    }
  }
  return visible;
};

// 连线隐藏支持:端点节点被 flags.hidden 隐藏时,不绘制该连线(避免悬空线);
// 因提前 return,该连线也不会进入 visible_links,故同样不可点中,与节点隐藏行为一致。
// link == null 的拖拽预览线不受影响。
const _origRenderLink = LGraphCanvas.prototype.renderLink;
LGraphCanvas.prototype.renderLink = function (ctx, a, b, link, ...args) {
  if (link && this.graph) {
    const o = this.graph.getNodeById(link.origin_id);
    const t = this.graph.getNodeById(link.target_id);
    if (o?.flags?.hidden || t?.flags?.hidden) return;
  }
  return _origRenderLink.call(this, ctx, a, b, link, ...args);
};

LGraphCanvas.prototype.drawNode = function (node, ctx) {
  var glow = false;
  this.current_node = node;

  var color =
    node.color || node.constructor.color || LiteGraph.NODE_DEFAULT_COLOR;
  var bgcolor =
    node.bgcolor || node.constructor.bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR;

  //shadow and glow
  if (node.mouseOver) {
    glow = true;
  }

  var low_quality = this.ds.scale < 0.6; //zoomed out

  //only render if it forces it to do it
  if (this.live_mode) {
    if (!node.flags.collapsed) {
      ctx.shadowColor = "transparent";
      if (node.onDrawForeground) {
        node.onDrawForeground(ctx, this, this.canvas);
      }
    }
    return;
  }

  var editor_alpha = this.editor_alpha;
  ctx.globalAlpha = editor_alpha;

  if (this.render_shadows && !low_quality) {
    ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
    ctx.shadowOffsetX = 2 * this.ds.scale;
    ctx.shadowOffsetY = 2 * this.ds.scale;
    ctx.shadowBlur = 3 * this.ds.scale;
  } else {
    ctx.shadowColor = "transparent";
  }

  //custom draw collapsed method (draw after shadows because they are affected)
  if (
    node.flags.collapsed &&
    node.onDrawCollapsed &&
    node.onDrawCollapsed(ctx, this) == true
  ) {
    return;
  }

  //clip if required (mask)
  var shape = node._shape || LiteGraph.BOX_SHAPE;
  var size = temp_vec2;
  temp_vec2.set(node.size);
  var horizontal = node.horizontal; // || node.flags.horizontal;

  if (node.flags.collapsed) {
    ctx.font = this.inner_text_font;
    var title = node.getTitle ? node.getTitle() : node.title;
    if (title != null) {
      node._collapsed_width = Math.min(
        node.size[0],
        ctx.measureText(title).width + LiteGraph.NODE_TITLE_HEIGHT * 2,
      ); //LiteGraph.NODE_COLLAPSED_WIDTH;
      size[0] = node._collapsed_width;
      size[1] = 0;
    }
  }

  if (node.clip_area) {
    //Start clipping
    ctx.save();
    ctx.beginPath();
    if (shape == LiteGraph.BOX_SHAPE) {
      ctx.rect(0, 0, size[0], size[1]);
    } else if (shape == LiteGraph.ROUND_SHAPE) {
      ctx.roundRect(0, 0, size[0], size[1], [10]);
    } else if (shape == LiteGraph.CIRCLE_SHAPE) {
      ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2);
    }
    ctx.clip();
  }

  //draw shape
  if (node.has_errors) {
    bgcolor = "red";
  }
  this.drawNodeShape(
    node,
    ctx,
    size,
    color,
    bgcolor,
    node.is_selected,
    node.mouseOver,
  );
  ctx.shadowColor = "transparent";

  //draw foreground
  if (node.onDrawForeground) {
    node.onDrawForeground(ctx, this, this.canvas);
  }

  //connection slots
  ctx.textAlign = horizontal ? "center" : "left";
  ctx.font = this.inner_text_font;

  var render_text = !low_quality;

  var out_slot = this.connecting_output;
  var in_slot = this.connecting_input;
  ctx.lineWidth = 1;

  var max_y = 0;
  var slot_pos = new Float32Array(2); //to reuse

  //render inputs and outputs
  if (!node.flags.collapsed) {
    //input connection slots
    if (node.inputs) {
      for (var i = 0; i < node.inputs.length; i++) {
        var slot = node.inputs[i];

        var slot_type = slot.type;
        var slot_shape = slot.shape;
        // 如果是隐藏槽 (hideOnNode), 跳过后续绘制但保持高度占位
        if (slot.hideOnNode === true) {
          continue;
        }

        ctx.globalAlpha = editor_alpha;
        //change opacity of incompatible slots when dragging a connection
        if (
          this.connecting_output &&
          !LiteGraph.isValidConnection(slot.type, out_slot.type)
        ) {
          ctx.globalAlpha = 0.4 * editor_alpha;
        }

        ctx.fillStyle =
          slot.link != null
            ? slot.color_on ||
              this.default_connection_color_byType[slot_type] ||
              this.default_connection_color.input_on
            : slot.color_off ||
              this.default_connection_color_byTypeOff[slot_type] ||
              this.default_connection_color_byType[slot_type] ||
              this.default_connection_color.input_off;

        var pos = node.getConnectionPos(true, i, slot_pos);
        pos[0] -= node.pos[0];
        pos[1] -= node.pos[1];
        if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
          max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
        }

        ctx.beginPath();

        if (slot_type == "array") {
          slot_shape = LiteGraph.GRID_SHAPE; // place in addInput? addOutput instead?
        }

        var doStroke = true;
        if (
          slot.type === LiteGraph.EVENT ||
          slot.shape === LiteGraph.BOX_SHAPE
        ) {
          if (horizontal) {
            ctx.rect(pos[0] - 5 + 0.5, pos[1] - 8 + 0.5, 10, 14);
          } else {
            ctx.rect(pos[0] - 6 + 0.5, pos[1] - 5 + 0.5, 14, 10);
          }
        } else if (slot_shape === LiteGraph.ARROW_SHAPE) {
          ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
          ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
          ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
          ctx.closePath();
        } else if (slot_shape === LiteGraph.GRID_SHAPE) {
          ctx.rect(pos[0] - 4, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] - 4, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] - 4, pos[1] + 2, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] + 2, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] + 2, 2, 2);
          doStroke = false;
        } else {
          if (low_quality)
            ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8); //faster
          else ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
        }

        ctx.fill();

        //render name
        if (render_text) {
          var text = slot.label != null ? slot.label : slot.name;
          text = text;
          if (text) {
            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
            if (horizontal || slot.dir == LiteGraph.UP) {
              ctx.fillText(text, pos[0], pos[1] - 10);
            } else {
              ctx.fillText(text, pos[0] + 10, pos[1] + 5);
            }
          }
        }
      }
    }

    //output connection slots

    ctx.textAlign = horizontal ? "center" : "right";
    ctx.strokeStyle = "black";
    if (node.outputs) {
      for (var i = 0; i < node.outputs.length; i++) {
        var slot = node.outputs[i];

        var slot_type = slot.type;
        var slot_shape = slot.shape;
        // 如果是隐藏槽 (hideOnNode), 跳过后续绘制但保持高度占位

        if (slot.hideOnNode) {
          continue;
        }
        //change opacity of incompatible slots when dragging a connection
        if (
          this.connecting_input &&
          !LiteGraph.isValidConnection(slot_type, in_slot.type)
        ) {
          ctx.globalAlpha = 0.4 * editor_alpha;
        }

        var pos = node.getConnectionPos(false, i, slot_pos);
        pos[0] -= node.pos[0];
        pos[1] -= node.pos[1];
        if (max_y < pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5) {
          max_y = pos[1] + LiteGraph.NODE_SLOT_HEIGHT * 0.5;
        }

        ctx.fillStyle =
          slot.links && slot.links.length
            ? slot.color_on ||
              this.default_connection_color_byType[slot_type] ||
              this.default_connection_color.output_on
            : slot.color_off ||
              this.default_connection_color_byTypeOff[slot_type] ||
              this.default_connection_color_byType[slot_type] ||
              this.default_connection_color.output_off;
        ctx.beginPath();
        //ctx.rect( node.size[0] - 14,i*14,10,10);

        if (slot_type == "array") {
          slot_shape = LiteGraph.GRID_SHAPE;
        }

        var doStroke = true;

        if (
          slot_type === LiteGraph.EVENT ||
          slot_shape === LiteGraph.BOX_SHAPE
        ) {
          if (horizontal) {
            ctx.rect(pos[0] - 5 + 0.5, pos[1] - 8 + 0.5, 10, 14);
          } else {
            ctx.rect(pos[0] - 6 + 0.5, pos[1] - 5 + 0.5, 14, 10);
          }
        } else if (slot_shape === LiteGraph.ARROW_SHAPE) {
          ctx.moveTo(pos[0] + 8, pos[1] + 0.5);
          ctx.lineTo(pos[0] - 4, pos[1] + 6 + 0.5);
          ctx.lineTo(pos[0] - 4, pos[1] - 6 + 0.5);
          ctx.closePath();
        } else if (slot_shape === LiteGraph.GRID_SHAPE) {
          ctx.rect(pos[0] - 4, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] - 4, 2, 2);
          ctx.rect(pos[0] - 4, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] - 1, 2, 2);
          ctx.rect(pos[0] - 4, pos[1] + 2, 2, 2);
          ctx.rect(pos[0] - 1, pos[1] + 2, 2, 2);
          ctx.rect(pos[0] + 2, pos[1] + 2, 2, 2);
          doStroke = false;
        } else {
          if (low_quality) ctx.rect(pos[0] - 4, pos[1] - 4, 8, 8);
          else ctx.arc(pos[0], pos[1], 4, 0, Math.PI * 2);
        }

        //trigger
        //if(slot.node_id != null && slot.slot == -1)
        //	ctx.fillStyle = "#F85";

        //if(slot.links != null && slot.links.length)
        ctx.fill();
        if (!low_quality && doStroke) ctx.stroke();

        //render output name
        if (render_text) {
          var text = slot.label != null ? slot.label : slot.name;
          text = text;
          if (text) {
            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
            if (horizontal || slot.dir == LiteGraph.DOWN) {
              ctx.fillText(text, pos[0], pos[1] - 8);
            } else {
              ctx.fillText(text, pos[0] - 10, pos[1] + 5);
            }
          }
        }
      }
    }

    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    if (node.widgets) {
      var widgets_y = max_y;
      if (horizontal || node.widgets_up) {
        widgets_y = 2;
      }
      if (node.widgets_start_y != null) widgets_y = node.widgets_start_y;
      this.drawNodeWidgets(
        node,
        widgets_y,
        ctx,
        this.node_widget && this.node_widget[0] == node
          ? this.node_widget[1]
          : null,
      );
    }
  } else if (this.render_collapsed_slots) {
    //if collapsed
    var input_slot = null;
    var output_slot = null;

    //get first connected slot to render
    if (node.inputs) {
      for (var i = 0; i < node.inputs.length; i++) {
        var slot = node.inputs[i];
        if (slot.link == null) {
          continue;
        }
        input_slot = slot;
        break;
      }
    }
    if (node.outputs) {
      for (var i = 0; i < node.outputs.length; i++) {
        var slot = node.outputs[i];
        if (!slot.links || !slot.links.length) {
          continue;
        }
        output_slot = slot;
      }
    }

    if (input_slot) {
      var x = 0;
      var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
      if (horizontal) {
        x = node._collapsed_width * 0.5;
        y = -LiteGraph.NODE_TITLE_HEIGHT;
      }
      ctx.fillStyle = "#686";
      ctx.beginPath();
      if (slot.type === LiteGraph.EVENT || slot.shape === LiteGraph.BOX_SHAPE) {
        ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
      } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + -4, y - 4);
        ctx.lineTo(x + -4, y + 4);
        ctx.closePath();
      } else {
        ctx.arc(x, y, 4, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    if (output_slot) {
      var x = node._collapsed_width;
      var y = LiteGraph.NODE_TITLE_HEIGHT * -0.5; //center
      if (horizontal) {
        x = node._collapsed_width * 0.5;
        y = 0;
      }
      ctx.fillStyle = "#686";
      ctx.strokeStyle = "black";
      ctx.beginPath();
      if (slot.type === LiteGraph.EVENT || slot.shape === LiteGraph.BOX_SHAPE) {
        ctx.rect(x - 7 + 0.5, y - 4, 14, 8);
      } else if (slot.shape === LiteGraph.ARROW_SHAPE) {
        ctx.moveTo(x + 6, y);
        ctx.lineTo(x - 6, y - 4);
        ctx.lineTo(x - 6, y + 4);
        ctx.closePath();
      } else {
        ctx.arc(x, y, 4, 0, Math.PI * 2);
      }
      ctx.fill();
      //ctx.stroke();
    }
  }

  if (node.clip_area) {
    ctx.restore();
  }

  ctx.globalAlpha = 1.0;
};

var tmp_area = new Float32Array(4);

LGraphCanvas.prototype.drawNodeShape = function (
  node,
  ctx,
  size,
  fgcolor,
  bgcolor,
  selected,
  mouse_over,
) {
  //bg rect
  ctx.strokeStyle = fgcolor;
  ctx.fillStyle = bgcolor;

  var title_height = LiteGraph.NODE_TITLE_HEIGHT;
  var low_quality = this.ds.scale < 0.5;

  //render node area depending on shape
  var shape = node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE;

  var title_mode = node.constructor.title_mode;

  var render_title = true;
  if (
    title_mode == LiteGraph.TRANSPARENT_TITLE ||
    title_mode == LiteGraph.NO_TITLE
  ) {
    render_title = false;
  } else if (title_mode == LiteGraph.AUTOHIDE_TITLE && mouse_over) {
    render_title = true;
  }

  var area = tmp_area;
  area[0] = 0; //x
  area[1] = render_title ? -title_height : 0; //y
  area[2] = size[0] + 1; //w
  area[3] = render_title ? size[1] + title_height : size[1]; //h

  var old_alpha = ctx.globalAlpha;

  //full node shape
  //if(node.flags.collapsed)
  {
    ctx.beginPath();
    if (shape == LiteGraph.BOX_SHAPE || low_quality) {
      ctx.fillRect(area[0], area[1], area[2], area[3]);
    } else if (
      shape == LiteGraph.ROUND_SHAPE ||
      shape == LiteGraph.CARD_SHAPE
    ) {
      ctx.roundRect(
        area[0],
        area[1],
        area[2],
        area[3],
        shape == LiteGraph.CARD_SHAPE
          ? [this.round_radius, this.round_radius, 0, 0]
          : [this.round_radius],
      );
    } else if (shape == LiteGraph.CIRCLE_SHAPE) {
      ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5, 0, Math.PI * 2);
    }
    ctx.fill();

    //separator
    if (!node.flags.collapsed && render_title) {
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, -1, area[2], 2);
    }
  }
  ctx.shadowColor = "transparent";

  //title bg (remember, it is rendered ABOVE the node)
  if (render_title || title_mode == LiteGraph.TRANSPARENT_TITLE) {
    //title bar
    if (node.onDrawTitleBar) {
      node.onDrawTitleBar(ctx, title_height, size, this.ds.scale, fgcolor);
    } else if (
      title_mode != LiteGraph.TRANSPARENT_TITLE &&
      (node.constructor.title_color || this.render_title_colored)
    ) {
      var title_color = node.constructor.title_color || fgcolor;

      if (node.flags.collapsed) {
        ctx.shadowColor = LiteGraph.DEFAULT_SHADOW_COLOR;
      }

      //* gradient test
      if (this.use_gradients) {
        var grad = LGraphCanvas.gradients[title_color];
        if (!grad) {
          grad = LGraphCanvas.gradients[title_color] = ctx.createLinearGradient(
            0,
            0,
            400,
            0,
          );
          grad.addColorStop(0, title_color); // TODO refactor: validate color !! prevent DOMException
          grad.addColorStop(1, "#000");
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = title_color;
      }

      //ctx.globalAlpha = 0.5 * old_alpha;
      ctx.beginPath();
      if (shape == LiteGraph.BOX_SHAPE || low_quality) {
        ctx.rect(0, -title_height, size[0] + 1, title_height);
      } else if (
        shape == LiteGraph.ROUND_SHAPE ||
        shape == LiteGraph.CARD_SHAPE
      ) {
        ctx.roundRect(
          0,
          -title_height,
          size[0] + 1,
          title_height,
          node.flags.collapsed
            ? [this.round_radius]
            : [this.round_radius, this.round_radius, 0, 0],
        );
      }
      ctx.fill();
      ctx.shadowColor = "transparent";
    }

    var colState = false;
    if (LiteGraph.node_box_coloured_by_mode) {
      if (LiteGraph.NODE_MODES_COLORS[node.mode]) {
        colState = LiteGraph.NODE_MODES_COLORS[node.mode];
      }
    }
    if (LiteGraph.node_box_coloured_when_on) {
      colState = node.action_triggered
        ? "#FFF"
        : node.execute_triggered
          ? "#AAA"
          : colState;
    }

    //title box
    var box_size = 10;
    if (node.onDrawTitleBox) {
      node.onDrawTitleBox(ctx, title_height, size, this.ds.scale);
    } else if (
      shape == LiteGraph.ROUND_SHAPE ||
      shape == LiteGraph.CIRCLE_SHAPE ||
      shape == LiteGraph.CARD_SHAPE
    ) {
      if (low_quality) {
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(
          title_height * 0.5,
          title_height * -0.5,
          box_size * 0.5 + 1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.fillStyle =
        node.boxcolor || colState || LiteGraph.NODE_DEFAULT_BOXCOLOR;
      if (low_quality)
        ctx.fillRect(
          title_height * 0.5 - box_size * 0.5,
          title_height * -0.5 - box_size * 0.5,
          box_size,
          box_size,
        );
      else {
        ctx.beginPath();
        ctx.arc(
          title_height * 0.5,
          title_height * -0.5,
          box_size * 0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      if (low_quality) {
        ctx.fillStyle = "black";
        ctx.fillRect(
          (title_height - box_size) * 0.5 - 1,
          (title_height + box_size) * -0.5 - 1,
          box_size + 2,
          box_size + 2,
        );
      }
      ctx.fillStyle =
        node.boxcolor || colState || LiteGraph.NODE_DEFAULT_BOXCOLOR;
      ctx.fillRect(
        (title_height - box_size) * 0.5,
        (title_height + box_size) * -0.5,
        box_size,
        box_size,
      );
    }
    ctx.globalAlpha = old_alpha;

    //title text
    if (node.onDrawTitleText) {
      node.onDrawTitleText(
        ctx,
        title_height,
        size,
        this.ds.scale,
        this.title_text_font,
        selected,
      );
    }
    if (!low_quality) {
      ctx.font = this.title_text_font;
      var title = String(node.getTitle());
      if (title) {
        if (selected) {
          ctx.fillStyle = LiteGraph.NODE_SELECTED_TITLE_COLOR;
        } else {
          ctx.fillStyle =
            node.constructor.title_text_color || this.node_title_color;
        }
        if (node.flags.collapsed) {
          ctx.textAlign = "left";
          var measure = ctx.measureText(title);
          ctx.fillText(
            title.substr(0, 20), //avoid urls too long
            title_height, // + measure.width * 0.5,
            LiteGraph.NODE_TITLE_TEXT_Y - title_height,
          );
          ctx.textAlign = "left";
        } else {
          ctx.textAlign = "left";
          ctx.fillText(
            title,
            title_height,
            LiteGraph.NODE_TITLE_TEXT_Y - title_height,
          );
        }
      }
    }

    //subgraph box
    if (!node.flags.collapsed && node.subgraph && !node.skip_subgraph_button) {
      var w = LiteGraph.NODE_TITLE_HEIGHT;
      var x = node.size[0] - w;
      var over = LiteGraph.isInsideRectangle(
        this.graph_mouse[0] - node.pos[0],
        this.graph_mouse[1] - node.pos[1],
        x + 2,
        -w + 2,
        w - 4,
        w - 4,
      );
      ctx.fillStyle = over ? "#888" : "#555";
      if (shape == LiteGraph.BOX_SHAPE || low_quality)
        ctx.fillRect(x + 2, -w + 2, w - 4, w - 4);
      else {
        ctx.beginPath();
        ctx.roundRect(x + 2, -w + 2, w - 4, w - 4, [4]);
        ctx.fill();
      }
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, -w * 0.6);
      ctx.lineTo(x + w * 0.8, -w * 0.6);
      ctx.lineTo(x + w * 0.5, -w * 0.3);
      ctx.fill();
    }

    //custom title render
    if (node.onDrawTitle) {
      node.onDrawTitle(ctx);
    }
  }

  //render selection marker
  if (selected) {
    if (node.onBounding) {
      node.onBounding(area);
    }

    if (title_mode == LiteGraph.TRANSPARENT_TITLE) {
      area[1] -= title_height;
      area[3] += title_height;
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    if (shape == LiteGraph.BOX_SHAPE) {
      ctx.rect(-6 + area[0], -6 + area[1], 12 + area[2], 12 + area[3]);
    } else if (
      shape == LiteGraph.ROUND_SHAPE ||
      (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
    ) {
      ctx.roundRect(-6 + area[0], -6 + area[1], 12 + area[2], 12 + area[3], [
        this.round_radius * 2,
      ]);
    } else if (shape == LiteGraph.CARD_SHAPE) {
      ctx.roundRect(-6 + area[0], -6 + area[1], 12 + area[2], 12 + area[3], [
        this.round_radius * 2,
        2,
        this.round_radius * 2,
        2,
      ]);
    } else if (shape == LiteGraph.CIRCLE_SHAPE) {
      ctx.arc(size[0] * 0.5, size[1] * 0.5, size[0] * 0.5 + 6, 0, Math.PI * 2);
    }
    ctx.strokeStyle = LiteGraph.NODE_BOX_OUTLINE_COLOR;
    ctx.stroke();
    ctx.strokeStyle = fgcolor;
    ctx.globalAlpha = 1;
  }

  // these counter helps in conditioning drawing based on if the node has been executed or an action occurred
  if (node.execute_triggered > 0) node.execute_triggered--;
  if (node.action_triggered > 0) node.action_triggered--;
};

/**
 * returns the center of a connection point in canvas coords
 * @method getConnectionPos
 * @param {boolean} is_input true if if a input slot, false if it is an output
 * @param {number_or_string} slot (could be the number of the slot or the string with the name of the slot)
 * @param {vec2} out [optional] a place to store the output, to free garbage
 * @return {[x,y]} the position
 **/
LGraphNode.prototype.getConnectionPos = function (is_input, slot_number, out) {
  out = out || new Float32Array(2);
  var num_slots = 0;
  if (is_input && this.inputs) {
    num_slots = this.inputs.length;
  }
  if (!is_input && this.outputs) {
    num_slots = this.outputs.length;
  }

  var offset = LiteGraph.NODE_SLOT_HEIGHT * 0.5;

  if (this.flags.collapsed) {
    var w = this._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH;
    if (this.horizontal) {
      out[0] = this.pos[0] + w * 0.5;
      if (is_input) {
        out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT;
      } else {
        out[1] = this.pos[1];
      }
    } else {
      if (is_input) {
        out[0] = this.pos[0];
      } else {
        out[0] = this.pos[0] + w;
      }
      out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT * 0.5;
    }
    return out;
  }

  //weird feature that never got finished
  if (is_input && slot_number == -1) {
    out[0] = this.pos[0] + LiteGraph.NODE_TITLE_HEIGHT * 0.5;
    out[1] = this.pos[1] + LiteGraph.NODE_TITLE_HEIGHT * 0.5;
    return out;
  }

  //hard-coded pos
  if (is_input && num_slots > slot_number && this.inputs[slot_number].pos) {
    out[0] = this.pos[0] + this.inputs[slot_number].pos[0];
    out[1] = this.pos[1] + this.inputs[slot_number].pos[1];
    return out;
  } else if (
    !is_input &&
    num_slots > slot_number &&
    this.outputs[slot_number].pos
  ) {
    out[0] = this.pos[0] + this.outputs[slot_number].pos[0];
    out[1] = this.pos[1] + this.outputs[slot_number].pos[1];
    return out;
  }

  //horizontal distributed slots
  if (this.horizontal) {
    out[0] = this.pos[0] + (slot_number + 0.5) * (this.size[0] / num_slots);
    if (is_input) {
      out[1] = this.pos[1] - LiteGraph.NODE_TITLE_HEIGHT;
    } else {
      out[1] = this.pos[1] + this.size[1];
    }
    return out;
  }

  //default vertical slots
  if (is_input) {
    out[0] = this.pos[0] + offset;
  } else {
    out[0] = this.pos[0] + this.size[0] + 1 - offset;
  }
  var effective_slot_index = 0;
  if (is_input) {
    for (var i = 0; i < slot_number; ++i) {
      if (this.inputs[i] && !this.inputs[i].hideOnNode) {
        effective_slot_index++;
      }
    }
  } else {
    for (var i = 0; i < slot_number; ++i) {
      if (this.outputs[i] && !this.outputs[i].hideOnNode) {
        effective_slot_index++;
      }
    }
  }
  out[1] =
    this.pos[1] +
    (effective_slot_index + 0.7) * LiteGraph.NODE_SLOT_HEIGHT +
    (this.constructor.slot_start_y || 0);
  return out;
};

LGraphCanvas.prototype.isOverNodeInput = function (
  node,
  canvasx,
  canvasy,
  slot_pos,
) {
  if (node.inputs)
    for (var i = 0, l = node.inputs.length; i < l; ++i) {
      var input = node.inputs[i];
      if (input.hideOnNode) {
        continue;
      }
      var link_pos = node.getConnectionPos(true, i);
      var is_inside = false;
      if (node.horizontal) {
        is_inside = isInsideRectangle(
          canvasx,
          canvasy,
          link_pos[0] - 5,
          link_pos[1] - 10,
          10,
          20,
        );
      } else {
        is_inside = isInsideRectangle(
          canvasx,
          canvasy,
          link_pos[0] - 10,
          link_pos[1] - 5,
          20,
          10,
        );
      }
      if (is_inside) {
        if (slot_pos) {
          slot_pos[0] = link_pos[0];
          slot_pos[1] = link_pos[1];
        }
        return i;
      }
    }
  return -1;
};

LGraphCanvas.prototype.isOverNodeOutput = function (
  node,
  canvasx,
  canvasy,
  slot_pos,
) {
  if (node.outputs)
    for (var i = 0, l = node.outputs.length; i < l; ++i) {
      var output = node.outputs[i];
      if (output.hideOnNode) {
        continue;
      }
      var link_pos = node.getConnectionPos(false, i);
      var is_inside = false;
      if (node.horizontal) {
        is_inside = isInsideRectangle(
          canvasx,
          canvasy,
          link_pos[0] - 5,
          link_pos[1] - 10,
          10,
          20,
        );
      } else {
        is_inside = isInsideRectangle(
          canvasx,
          canvasy,
          link_pos[0] - 10,
          link_pos[1] - 5,
          20,
          10,
        );
      }
      if (is_inside) {
        if (slot_pos) {
          slot_pos[0] = link_pos[0];
          slot_pos[1] = link_pos[1];
        }
        return i;
      }
    }
  return -1;
};

function overlapBounding(a, b) {
  var A_end_x = a[0] + a[2];
  var A_end_y = a[1] + a[3];
  var B_end_x = b[0] + b[2];
  var B_end_y = b[1] + b[3];

  if (a[0] > B_end_x || a[1] > B_end_y || A_end_x < b[0] || A_end_y < b[1]) {
    return false;
  }
  return true;
}
LiteGraph.overlapBounding = overlapBounding;

LGraph.prototype.runOnce = function () {
  this.status = LGraph.STATUS_RUNNING;

  if (this.onPlayEvent) {
    this.onPlayEvent();
  }

  this.sendEventToAllNodes("onStart");

  this.starttime = LiteGraph.getTime();
  this.last_update_time = this.starttime;

  var that = this;

  if (that.onBeforeStep) that.onBeforeStep();
  that.runStep(1, !that.catch_errors);
  if (that.onAfterStep) that.onAfterStep();

  this.status = LGraph.STATUS_STOPPED;
};

// ==================== Slot 操作扩展（基于 id）====================

/**
 * 通过 id 查找输入 slot
 * @param {string} slotId - slot 的唯一 id
 * @returns {{ slot: object, index: number } | null}
 */
LGraphNode.prototype.findInputSlotById = function (slotId) {
  if (!this.inputs || !slotId) return null;
  const index = this.inputs.findIndex((slot) => slot.id === slotId);
  if (index === -1) return null;
  return { slot: this.inputs[index], index };
};

/**
 * 通过 id 查找输出 slot
 * @param {string} slotId - slot 的唯一 id
 * @returns {{ slot: object, index: number } | null}
 */
LGraphNode.prototype.findOutputSlotById = function (slotId) {
  if (!this.outputs || !slotId) return null;
  const index = this.outputs.findIndex((slot) => slot.id === slotId);
  if (index === -1) return null;
  return { slot: this.outputs[index], index };
};

/**
 * 通过 id 查找 slot（自动判断输入或输出）
 * @param {string} slotId - slot 的唯一 id
 * @returns {{ slot: object, index: number, isInput: boolean } | null}
 */
LGraphNode.prototype.findSlotById = function (slotId) {
  const inputResult = this.findInputSlotById(slotId);
  if (inputResult) {
    return { ...inputResult, isInput: true };
  }
  const outputResult = this.findOutputSlotById(slotId);
  if (outputResult) {
    return { ...outputResult, isInput: false };
  }
  return null;
};

/**
 * 通过 id 更新输出 slot 的名称
 * @param {string} slotId - slot 的唯一 id
 * @param {string} newName - 新名称
 * @param {boolean} refreshCanvas - 是否刷新画布，默认 true
 * @returns {boolean} - 是否更新成功
 */
LGraphNode.prototype.updateOutputSlotNameById = function (
  slotId,
  newName,
  refreshCanvas = true,
) {
  const result = this.findOutputSlotById(slotId);
  if (!result) return false;
  result.slot.name = newName;
  if (refreshCanvas && this.graph) {
    this.graph.setDirtyCanvas?.(true, true);
  }
  return true;
};

/**
 * 通过 id 更新输入 slot 的名称
 * @param {string} slotId - slot 的唯一 id
 * @param {string} newName - 新名称
 * @param {boolean} refreshCanvas - 是否刷新画布，默认 true
 * @returns {boolean} - 是否更新成功
 */
LGraphNode.prototype.updateInputSlotNameById = function (
  slotId,
  newName,
  refreshCanvas = true,
) {
  const result = this.findInputSlotById(slotId);
  if (!result) return false;
  result.slot.name = newName;
  if (refreshCanvas && this.graph) {
    this.graph.setDirtyCanvas?.(true, true);
  }
  return true;
};

/**
 * 通过 id 更新 slot 属性（通用方法）
 * @param {string} slotId - slot 的唯一 id
 * @param {object} updates - 要更新的属性对象
 * @param {boolean} refreshCanvas - 是否刷新画布，默认 true
 * @returns {boolean} - 是否更新成功
 */
LGraphNode.prototype.updateSlotById = function (
  slotId,
  updates,
  refreshCanvas = true,
) {
  const result = this.findSlotById(slotId);
  if (!result) return false;
  Object.assign(result.slot, updates);
  if (refreshCanvas && this.graph) {
    this.graph.setDirtyCanvas?.(true, true);
  }
  return true;
};

/**
 * 通过 id 删除输出 slot
 * @param {string} slotId - slot 的唯一 id
 * @returns {boolean} - 是否删除成功
 */
LGraphNode.prototype.removeOutputSlotById = function (slotId) {
  const result = this.findOutputSlotById(slotId);
  if (!result) return false;
  this.removeOutput(result.index);
  return true;
};

/**
 * 通过 id 删除输入 slot
 * @param {string} slotId - slot 的唯一 id
 * @returns {boolean} - 是否删除成功
 */
LGraphNode.prototype.removeInputSlotById = function (slotId) {
  const result = this.findInputSlotById(slotId);
  if (!result) return false;
  this.removeInput(result.index);
  return true;
};

/**
 * 通过 id 删除 slot（自动判断输入或输出）
 * @param {string} slotId - slot 的唯一 id
 * @returns {boolean} - 是否删除成功
 */
LGraphNode.prototype.removeSlotById = function (slotId) {
  if (this.removeInputSlotById(slotId)) return true;
  if (this.removeOutputSlotById(slotId)) return true;
  return false;
};

/**
 * 批量更新多个 slot 的名称
 * @param {Array<{slotId: string, name: string}>} updates - 更新配置数组
 * @param {boolean} refreshCanvas - 是否刷新画布，默认 true（仅在最后刷新一次）
 * @returns {number} - 成功更新的数量
 */
LGraphNode.prototype.batchUpdateSlotNames = function (
  updates,
  refreshCanvas = true,
) {
  let successCount = 0;
  for (const { slotId, name } of updates) {
    const result = this.findSlotById(slotId);
    if (result) {
      result.slot.name = name;
      successCount++;
    }
  }
  if (refreshCanvas && successCount > 0 && this.graph) {
    this.graph.setDirtyCanvas?.(true, true);
  }
  return successCount;
};

export {
  LGraph,
  LGraphCanvas,
  LiteGraph,
  LLink,
  LGraphNode,
  LGraphGroup,
  DragAndScale,
  ContextMenu,
};
