import { canvasRenderFrame, addCircle } from "./canvas-shared";

let canvas = document.getElementById("demo-canvas");

canvas.width = canvas.height = canvas.clientWidth * window.devicePixelRatio;

function render() {
  canvasRenderFrame(canvas);
  requestAnimationFrame(render);
}

render();

document.getElementById("add-circle").addEventListener("click", function() {
  addCircle(canvas);
});
