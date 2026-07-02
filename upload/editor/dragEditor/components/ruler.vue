<template>
  <div class="ruler-container panzoom-exclude" @wheel.stop.prevent @contextmenu.stop.prevent @dragstart.prevent>
    <div
      class="bg-grey-10 panzoom-exclude"
      style="
        top: -15px;
        left: -15px;
        width: 15px;
        height: 15px;
        position: absolute;
      "
    />
    <svg
      ref="horizontalRuler"
      class="ruler horizontal bg-grey-10 panzoom-exclude"
      :style="width"
    ></svg>
    <svg
      ref="verticalRuler"
      class="ruler vertical bg-grey-10 panzoom-exclude"
      :style="height"
    ></svg>
  </div>
</template>

<script setup>
import { computed, toRefs, watch } from "vue";
import { ref, onMounted } from "vue";

// 组件名声明
defineOptions({
  name: 'RulerScale'
});

const props = defineProps(["height", "width"]);
// https://github.com/kakajun/vue3-sketch-ruler?tab=readme-ov-file
// #TODO:  以后用这个替换
// 获取水平和垂直方向的 SVG 元素
const horizontalRuler = ref(null);
const verticalRuler = ref(null);

// 定义刻度线长度、主刻度线高度和副刻度线高度
const tickLength = 0.5;
const majorTickHeight = 6;
const minorTickHeight = 3;

const textColor = "white";
const rulerColor = "white";
// 定义刻度尺总长度、主刻度线之间的间隔和刻度值之间的间隔
const width = computed(
  () =>
    "width:" +
    (parseInt(props.width) + 10).toString() +
    "px" +
    ";height:" +
    15 +
    "px",
);
const height = computed(
  () =>
    "height:" +
    (parseInt(props.height) + 10).toString() +
    ";width:" +
    15 +
    "px",
);
const htotalLength = props.width;

const vtotalLength = props.height;
const interval = 5;
const labelInterval = 20;
const renderRuler = () => {
  // 绘制水平方向的刻度尺
  for (let i = 0; i <= props.width; i += interval) {
    // 计算当前刻度线的位置
    const x = i;

    // 绘制主刻度线
    const majorTick = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    let height = i % labelInterval === 0 ? majorTickHeight : minorTickHeight;
    majorTick.setAttribute("x1", x);
    majorTick.setAttribute("y1", height);
    majorTick.setAttribute("x2", x);
    majorTick.setAttribute("y2", -minorTickHeight);
    majorTick.setAttribute("stroke", rulerColor);
    majorTick.setAttribute("stroke-width", tickLength);
    horizontalRuler.value.appendChild(majorTick);

    // 绘制刻度值
    if (i % labelInterval === 0) {
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      label.setAttribute("x", x);
      label.setAttribute("y", majorTickHeight + height);
      label.setAttribute("font-size", "5px");
      label.setAttribute("fill", textColor);
      label.setAttribute("text-anchor", "middle");
      label.textContent = i === 0 ? "" : i.toString();
      horizontalRuler.value.appendChild(label);
    }
  }

  // 绘制垂直方向的刻度尺
  for (let i = 0; i <= props.height; i += interval) {
    // 计算当前刻度线的位置
    const y = i;
    // 绘制主刻度线
    const majorTick = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    let height = i % labelInterval === 0 ? majorTickHeight : minorTickHeight;
    majorTick.setAttribute("x1", height);
    majorTick.setAttribute("y1", y);
    majorTick.setAttribute("x2", -minorTickHeight);
    majorTick.setAttribute("y2", y);
    majorTick.setAttribute("stroke", rulerColor);
    majorTick.setAttribute("stroke-width", tickLength);
    verticalRuler.value.appendChild(majorTick);

    // 绘制刻度值
    if (i % labelInterval === 0) {
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      label.setAttribute("x", majorTickHeight + 2);
      label.setAttribute("y", y + 2);
      label.setAttribute("font-size", "5px");
      label.setAttribute("fill", textColor);
      label.textContent = i === 0 ? "" : i.toString();
      verticalRuler.value.appendChild(label);
    }
  }
};

onMounted(() => {
  renderRuler();
});
watch(props, () => {
  renderRuler();
});
</script>

<style scoped>
.ruler-container {
  display: flex;
  width: 100%;
  user-select: none;
}

.ruler {
  position: absolute;
}

.horizontal {
  top: -15px;
  left: 0px;

  /* 保留空间给垂直刻度尺 */
}

.vertical {
  left: -15px;
  top: 0px;
  /* 保留空间给水平刻度尺 */
}
</style>
