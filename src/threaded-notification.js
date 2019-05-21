const chain = [];

export function showThreadedNotification() {
  self.registration.showNotification("A threaded notification", {
    body: "This is an example of how a threaded notification could work",
    tag: "threaded-example",
    actions: [
      {
        action: "next",
        title: "Next"
      }
    ]
  });
}
console.log("setup listener");
self.addEventListener("notificationclick", function(e) {
  if (e.notification.tag !== "threaded-example") {
    return;
  }

  if (e.action === "close") {
    e.notification.close();
    return;
  }

  self.registration.showNotification("Second threaded notification", {
    tag: "threaded-example",
    body:
      "Imagine that we might go into more detail in the second screen, while not overwhelming the user on the first.",
    actions: [
      {
        action: "close",
        title: "Close"
      }
    ]
  });
});
