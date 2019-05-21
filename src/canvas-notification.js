import { canvasRenderFrame, addCircle } from "./canvas-shared";

export function showCanvasNotification() {
  let body =
    "canvas" in Notification.prototype
      ? "This notification uses an approximation of the HTML Canvas API to draw and animate a custom graphic. Tap the button below to add an element."
      : "This is fallback content for environments where canvas-in-notification is not supported";

  self.registration.showNotification("A Canvas notification", {
    body,
    canvas: {
      proportion: 1
    },
    actions: [
      {
        action: "add-circle",
        title: "Add circle"
      }
    ]
  });
}

self.addEventListener("notificationcanvasframe", function(e) {
  canvasRenderFrame(e.notification.canvas);
  e.notification.canvas.requestAnimationFrame();
});

self.addEventListener("notificationclick", function(e) {
  if (e.action != "add-circle") {
    return;
  }

  addCircle(e.notification.canvas);
});
