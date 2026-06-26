/**
 * LiteGraph ES6 - Graph Management
 * Refactored from litegraph.js to use ES6 class syntax
 */

export const LGraphStatus = {
  STOPPED: 1,
  RUNNING: 2
};

export class LGraph {
  constructor(o) {
    if (LiteGraph.debug) {
      console.log("Graph created");
    }
    
    this.list_of_graphcanvas = null;
    this.clear();

    if (o) {
      this.configure(o);
    }
  }

  // Default supported types
  static supported_types = ["number", "string", "boolean"];

  // Used to know which types of connections support this graph
  getSupportedTypes() {
    return this.supported_types || LGraph.supported_types;
  }

  /**
   * Removes all nodes from this graph
   */
  clear() {
    this.stop();
    this.status = LGraphStatus.STOPPED;

    this.last_node_id = 0;
    this.last_link_id = 0;

    this._version = -1; // used to detect changes

    // Safe clear
    if (this._nodes) {
      for (let i = 0; i < this._nodes.length; ++i) {
        const node = this._nodes[i];
        if (node.onRemoved) {
          node.onRemoved();
        }
      }
    }

    // Nodes
    this._nodes = [];
    this._nodes_by_id = {};
    this._nodes_in_order = []; // nodes sorted in execution order
    this._nodes_executable = null; // nodes that contain onExecute sorted in execution order

    // Other scene stuff
    this._groups = [];

    // Links
    this.links = {}; // container with all the links

    // Iterations
    this.iteration = 0;

    // Custom data
    this.config = {};
    this.vars = {};
    this.extra = {}; // to store custom data

    // Timing
    this.globaltime = 0;
    this.runningtime = 0;
    this.fixedtime = 0;
    this.fixedtime_lapse = 0.01;
    this.elapsed_time = 0.01;
    this.last_update_time = 0;
    this.starttime = 0;

    this.catch_errors = true;

    this.nodes_executing = [];
    this.nodes_actioning = [];
    this.nodes_executedAction = [];

    // Subgraph data
    this.inputs = {};
    this.outputs = {};

    // Notify canvas to redraw
    this.change();

    this.sendActionToCanvas("clear");
  }

  /**
   * Attach Canvas to this graph
   * @param {LGraphCanvas} graphcanvas
   */
  attachCanvas(graphcanvas) {
    if (graphcanvas.constructor !== LGraphCanvas) {
      throw "attachCanvas expects a LGraphCanvas instance";
    }
    if (graphcanvas.graph && graphcanvas.graph !== this) {
      graphcanvas.graph.detachCanvas(graphcanvas);
    }

    graphcanvas.graph = this;

    if (!this.list_of_graphcanvas) {
      this.list_of_graphcanvas = [];
    }
    this.list_of_graphcanvas.push(graphcanvas);
  }

  /**
   * Detach Canvas from this graph
   * @param {LGraphCanvas} graphcanvas
   */
  detachCanvas(graphcanvas) {
    if (!this.list_of_graphcanvas) {
      return;
    }

    const pos = this.list_of_graphcanvas.indexOf(graphcanvas);
    if (pos === -1) {
      return;
    }
    graphcanvas.graph = null;
    this.list_of_graphcanvas.splice(pos, 1);
  }

  /**
   * Starts running this graph every interval milliseconds
   * @param {number} interval - amount of milliseconds between executions, if 0 then it renders to the monitor refresh rate
   */
  start(interval) {
    if (this.status === LGraphStatus.RUNNING) {
      return;
    }
    this.status = LGraphStatus.RUNNING;

    if (this.onPlayEvent) {
      this.onPlayEvent();
    }

    this.sendEventToAllNodes("onStart");

    // Launch
    this.starttime = LiteGraph.getTime();
    this.last_update_time = this.starttime;
    interval = interval || 0;
    const that = this;

    // Execute once per frame
    if (interval === 0 && typeof window !== "undefined" && window.requestAnimationFrame) {
      function on_frame() {
        if (that.execution_timer_id !== -1) {
          return;
        }
        window.requestAnimationFrame(on_frame);
        if (that.onBeforeStep)
          that.onBeforeStep();
        that.runStep(1, !that.catch_errors);
        if (that.onAfterStep)
          that.onAfterStep();
      }
      this.execution_timer_id = -1;
      on_frame();
    } else { // Execute every 'interval' ms
      this.execution_timer_id = setInterval(function() {
        if (that.onBeforeStep)
          that.onBeforeStep();
        that.runStep(1, !that.catch_errors);
        if (that.onAfterStep)
          that.onAfterStep();
      }, interval);
    }
  }

  /**
   * Stops the execution loop of the graph
   */
  stop() {
    if (this.status === LGraphStatus.STOPPED) {
      return;
    }

    this.status = LGraphStatus.STOPPED;

    if (this.onStopEvent) {
      this.onStopEvent();
    }

    if (this.execution_timer_id !== null) {
      if (this.execution_timer_id !== -1) {
        clearInterval(this.execution_timer_id);
      }
      this.execution_timer_id = null;
    }

    this.sendEventToAllNodes("onStop");
  }

  /**
   * Run N steps (cycles) of the graph
   * @param {number} num - number of steps to run, default is 1
   * @param {Boolean} do_not_catch_errors - [optional] if you want to try/catch errors
   * @param {number} limit - max number of nodes to execute (used to execute from start to a node)
   */
  runStep(num, do_not_catch_errors, limit) {
    num = num || 1;

    const start = LiteGraph.getTime();
    this.globaltime = 0.001 * (start - this.starttime);

    // Not optimal: executes possible pending actions in node, problem is it is not optimized
    // It is done here as if it was done in the later loop it wont be called in the node missed the onExecute

    // From now on it will iterate only on executable nodes which is faster
    let nodes = this._nodes_executable ? this._nodes_executable : this._nodes;
    if (!nodes) {
      return;
    }

    limit = limit || nodes.length;

    if (do_not_catch_errors) {
      // Iterations
      for (let i = 0; i < num; i++) {
        for (let j = 0; j < limit; ++j) {
          const node = nodes[j];
          if (LiteGraph.use_deferred_actions && node._waiting_actions && node._waiting_actions.length)
            node.executePendingActions();
          if (node.mode === LiteGraph.ALWAYS && node.onExecute) {
            node.doExecute();
          }
        }

        this.fixedtime += this.fixedtime_lapse;
        if (this.onExecuteStep) {
          this.onExecuteStep();
        }
      }

      if (this.onAfterExecute) {
        this.onAfterExecute();
      }
    } else { // Catch errors
      try {
        // Iterations
        for (let i = 0; i < num; i++) {
          for (let j = 0; j < limit; ++j) {
            const node = nodes[j];
            if (LiteGraph.use_deferred_actions && node._waiting_actions && node._waiting_actions.length)
              node.executePendingActions();
            if (node.mode === LiteGraph.ALWAYS && node.onExecute) {
              node.doExecute();
            }
          }

          this.fixedtime += this.fixedtime_lapse;
          if (this.onExecuteStep) {
            this.onExecuteStep();
          }
        }

        if (this.onAfterExecute) {
          this.onAfterExecute();
        }
      } catch (err) {
        if (LiteGraph.throw_errors) {
          throw err;
        }
        console.error("Error executing graph:", err);
      }
    }

    this.version++;
  }

  /**
   * Updates the graph execution order
   */
  computeExecutionOrder() {
    // TODO: Implement topological sort for execution order
    this._nodes_in_order = this._nodes.slice();
    this._nodes_executable = this._nodes.filter(node => node.onExecute);
  }

  /**
   * Returns all nodes in the graph
   */
  get nodes() {
    return this._nodes;
  }

  /**
   * Returns a node by ID
   */
  getNodeById(id) {
    return this._nodes_by_id[id];
  }

  /**
   * Adds a node to the graph
   */
  add(node) {
    if (!node) return;
    
    // Generate unique ID
    if (node.id === -1 || this._nodes_by_id[node.id]) {
      node.id = ++this.last_node_id;
    }
    
    this._nodes.push(node);
    this._nodes_by_id[node.id] = node;
    node.graph = this;
    
    this._version++;
    this.computeExecutionOrder();
    this.change();
    
    if (node.onAdded) {
      node.onAdded();
    }
    
    return node;
  }

  /**
   * Removes a node from the graph
   */
  remove(node) {
    const index = this._nodes.indexOf(node);
    if (index === -1) return;
    
    if (node.onRemoved) {
      node.onRemoved();
    }
    
    this._nodes.splice(index, 1);
    delete this._nodes_by_id[node.id];
    node.graph = null;
    
    this._version++;
    this.computeExecutionOrder();
    this.change();
  }

  /**
   * Configure the graph from a serialized object
   */
  configure(o) {
    if (!o) return;
    
    this.clear();
    
    if (o.nodes) {
      for (let i = 0; i < o.nodes.length; ++i) {
        const node_data = o.nodes[i];
        const node = LiteGraph.createNode(node_data.type);
        if (node) {
          node.configure(node_data);
          this.add(node);
        }
      }
    }
    
    if (o.groups) {
      for (let i = 0; i < o.groups.length; ++i) {
        const group_data = o.groups[i];
        // TODO: Create and configure groups
      }
    }
    
    if (o.config) {
      this.config = o.config;
    }
    
    if (o.vars) {
      this.vars = o.vars;
    }
    
    if (o.extra) {
      this.extra = o.extra;
    }
    
    this.change();
  }

  /**
   * Serialize the graph
   */
  serialize() {
    const nodes = [];
    for (let i = 0; i < this._nodes.length; ++i) {
      nodes.push(this._nodes[i].serialize());
    }
    
    const groups = [];
    for (let i = 0; i < this._groups.length; ++i) {
      groups.push(this._groups[i].serialize());
    }
    
    return {
      nodes,
      groups,
      config: this.config,
      vars: this.vars,
      extra: this.extra
    };
  }

  /**
   * Notify change to canvas
   */
  change() {
    if (this.list_of_graphcanvas) {
      for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
        this.list_of_graphcanvas[i].setDirty(true, true);
      }
    }
  }

  /**
   * Send event to all nodes
   */
  sendEventToAllNodes(event_name, params) {
    for (let i = 0; i < this._nodes.length; ++i) {
      const node = this._nodes[i];
      if (node[event_name]) {
        node[event_name](params);
      }
    }
  }

  /**
   * Send action to canvas
   */
  sendActionToCanvas(action, params) {
    if (this.list_of_graphcanvas) {
      for (let i = 0; i < this.list_of_graphcanvas.length; ++i) {
        const canvas = this.list_of_graphcanvas[i];
        if (canvas[action]) {
          canvas[action](params);
        }
      }
    }
  }
}

export default LGraph;
