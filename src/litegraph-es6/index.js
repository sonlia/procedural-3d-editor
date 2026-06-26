// Main entry point for the refactored LiteGraph ES6 library
export { default as LiteGraph, LiteGraphConstants } from './constants.js';
export { LGraph } from './LGraph.js';

// Temporary stubs for classes not yet refactored to allow initial testing
// These will be replaced as we refactor more files

class LGraphNode {
    constructor(title) {
        this.title = title || "Untitled";
        this.inputs = [];
        this.outputs = [];
        this.properties = {};
        this.pos = [0, 0];
        this.size = [100, 50];
        this.color = "#333";
        this.bgcolor = "#444";
    }

    addInput(name, type) {
        this.inputs.push({ name, type, link: null });
        return this.inputs.length - 1;
    }

    addOutput(name, type) {
        this.outputs.push({ name, type, links: [] });
        return this.outputs.length - 1;
    }

    setOutputData(slot, data) {
        if (this.outputs[slot]) {
            this.outputs[slot]._data = data;
        }
    }

    getInputData(slot) {
        // Simplified for testing - real implementation needs graph traversal
        return this.inputs[slot]?.data;
    }

    onExecute() {
        // Override in subclasses
    }
}

class LGraphCanvas {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.graph = graph;
        this.ctx = canvas.getContext('2d');
        this.selected_nodes = {};
        this.node_in_prefix = null;
        
        // Set initial size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        this.bindEvents();
        this.draw();
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    }

    onMouseDown(e) {
        console.log("Mouse down at", e.clientX, e.clientY);
        // Simplified node selection logic would go here
    }

    onMouseMove(e) {
        // Dragging logic would go here
    }

    onMouseUp(e) {
        // Release logic
    }

    onContextMenu(e) {
        e.preventDefault();
        console.log("Context menu at", e.clientX, e.clientY);
        // Show node creation menu
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear background
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        const gridSize = 50;
        
        ctx.beginPath();
        for (let x = 0; x < width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Draw nodes if graph exists
        if (this.graph && this.graph._nodes) {
            this.graph._nodes.forEach(node => this.drawNode(node));
        }
    }

    drawNode(node) {
        const ctx = this.ctx;
        const [x, y] = node.pos;
        const [w, h] = node.size;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x + 2, y + 2, w, h);

        // Background
        ctx.fillStyle = node.bgcolor || "#444";
        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = node.color || "#666";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Title bar
        ctx.fillStyle = node.color || "#666";
        ctx.fillRect(x, y, w, 20);

        // Title text
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial";
        ctx.fillText(node.title, x + 5, y + 15);

        // Draw inputs
        if (node.inputs) {
            node.inputs.forEach((input, i) => {
                const iy = y + 30 + i * 20;
                ctx.fillStyle = "#aaa";
                ctx.beginPath();
                ctx.arc(x, iy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#ccc";
                ctx.font = "10px Arial";
                ctx.fillText(input.name, x + 10, iy + 3);
            });
        }

        // Draw outputs
        if (node.outputs) {
            node.outputs.forEach((output, i) => {
                const oy = y + 30 + i * 20;
                ctx.fillStyle = "#aaa";
                ctx.beginPath();
                ctx.arc(x + w, oy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#ccc";
                ctx.font = "10px Arial";
                ctx.fillText(output.name, x + w - 40, oy + 3);
            });
        }
    }
}

// Global registry for node types
const registered_node_types = {};

function registerNodeType(type, ctor) {
    registered_node_types[type] = ctor;
}

// Enhance LiteGraph export with registry
import { default as LiteGraphBase } from './constants.js';
LiteGraphBase.registered_node_types = registered_node_types;
LiteGraphBase.registerNodeType = registerNodeType;

export { LGraphNode, LGraphCanvas };
