import { getDB } from "./db";

self.addEventListener("install", function(e) {
  e.waitUntil(
    (async function() {
      // Add our dummy image to the offline cache. It is then picked up by
      // the fetch event in worker.js
      let cache = await caches.open("demo-cache");
      await cache.add("./dummy-image.png");
      // add our other page assets too
      await cache.add("./index.html");
      await cache.add("./canvas.html");
      await cache.add("./canvas-client.js");
      self.skipWaiting();
    })()
  );
});

export async function makeExampleOfflineResponse() {
  let db = await getDB();
  let existingCount = (await db.get("test-store", "increment")) || 0;

  existingCount++;

  await db.put("test-store", existingCount, "increment");

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <title>An offline page</title>
      <meta name="theme-color" content="#000000">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <h1>Hi.</h1>
      <p>This page has been loaded ${existingCount} times. We are keeping an incremental count in device local storage.</p>
      <p>This image is served from an offline cache:</p>
      <p><img style='width: 100%' src='./dummy-image.png'/></p>
      </body> 
  </html>
  `;
}
