# hybrid-test-worker

## What is this?

A quickly thrown together demo of a few (mostly notification-based) worker concepts. While it [works fine on the web](https://alastaircoote.github.io/hybrid-test-worker/dist/), it is intended to be paired with [hybrid](https://github.com/alastaircoote/hybrid), a worker demo app for iOS, which extends a number of the Service Worker APIs to do things like play video and draw canvases in notifications.

## Example code

- [Offline responses](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/fetch-offline-response.js)
- [Threaded notifications](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/threaded-notification.js)
- [Canvas drawing](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/canvas-shared.js)
  - [in HTML](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/canvas-client.js)
  - [in a notification](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/canvas-notification.js)
- [Live video notifications](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/live-video-notification.js)
- [Text reply notifications](https://github.com/alastaircoote/hybrid-test-worker/blob/master/src/text-reply-notification.js)
