import { makeExampleOfflineResponse } from "./fetch-offline-response.js";
import { showThreadedNotification } from "./threaded-notification";
import { showCanvasNotification } from "./canvas-notification";
import { showLiveVideoNotification } from "./live-video-notification";
import {
  showTextReplyNotification,
  makeStoredRepliesResponse
} from "./text-reply-notification";

self.addEventListener("activate", function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function(e) {
  e.respondWith(
    (async function() {
      let cacheMatch = await caches.match(e.request);

      if (cacheMatch) {
        // for this demo, this only happens when the browser tries to
        // load dummy-image.png
        return cacheMatch;
      }

      if (e.request.url.endsWith("/offline-page.html")) {
        return new Response(await makeExampleOfflineResponse(), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      } else if (e.request.url.endsWith("/replies.html")) {
        return new Response(await makeStoredRepliesResponse(), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      }

      // Otherwise make a normal request
      return fetch(e.request);
    })()
  );
});

self.addEventListener("message", function(msg) {
  let data = JSON.parse(msg.data);
  console.log("Received event:", data.action);
  if (data.action == "threaded-notification") {
    showThreadedNotification();
  } else if (data.action == "canvas-notification") {
    showCanvasNotification();
  } else if (data.action == "live-video-notification") {
    showLiveVideoNotification();
  } else if (data.action == "text-reply-notification") {
    showTextReplyNotification();
  }
});
