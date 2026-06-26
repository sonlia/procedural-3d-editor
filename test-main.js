// Simple test entry point for LiteGraph ES6 Refactor
import { LGraph, LGraphCanvas, LiteGraph, LGraphNode } from './src/litegraph-es6/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    
    try {
        // 1. Create Graph
        const graph = new LGraph();
        console.log("LGraph created:", graph);

        // 2. Create Canvas
        const canvasElement = document.getElementById('mycanvas');
        const canvas = new LGraphCanvas(canvasElement, graph);
        console.log("LGraphCanvas created:", canvas);

        // 3. Resize canvas to fit window
        function resize() {
            canvas.resize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', resize);
        resize();

        // 4. Add a simple custom node type if not exists
        if (!LiteGraph.registered_node_types["basic/source"]) {
            class SourceNode extends LGraphNode {
                constructor() {
                    super();
                    this.title = "Source";
                    this.addOutput("Value", "number");
                    this.properties = { value: 10 };
                }
                onExecute() {
                    this.setOutputData(0, this.properties.value);
                }
            }
            SourceNode.prototype.color = "#333";
            SourceNode.prototype.bgcolor = "#555";
            LiteGraph.registerNodeType("basic/source", SourceNode);
        }

        if (!LiteGraph.registered_node_types["basic/watch"]) {
            class WatchNode extends LGraphNode {
                constructor() {
                    super();
                    this.title = "Watch";
                    this.addInput("Value", "number");
                }
                onExecute() {
                    const v = this.getInputData(0);
                    this.title = "Watch: " + (v !== undefined ? v : "no data");
                }
            }
            WatchNode.prototype.color = "#323";
            WatchNode.prototype.bgcolor = "#535";
            LiteGraph.registerNodeType("basic/watch", WatchNode);
        }

        // 5. Add some default nodes
        const nodeA = graph.addNode("Source", "basic/source");
        nodeA.pos = [100, 100];
        
        const nodeB = graph.addNode("Watch", "basic/watch");
        nodeB.pos = [400, 100];

        // 6. Connect them
        nodeA.connect(0, nodeB, 0);

        // 7. Start Graph
        graph.start();

        statusEl.textContent = "Running Successfully!";
        statusEl.style.color = "#4f4";
        
        console.log("Test setup complete. Graph running.");

    } catch (error) {
        console.error("Error initializing LiteGraph:", error);
        statusEl.textContent = "Error: " + error.message;
        statusEl.style.color = "#f44";
    }
});
