(function () {
  'use strict';

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  const instanceOfAny = (object, constructors) => constructors.some(c => object instanceof c);

  let idbProxyableTypes;
  let cursorAdvanceMethods; // This is a function to prevent it throwing up in node environments.

  function getIdbProxyableTypes() {
    return idbProxyableTypes || (idbProxyableTypes = [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction]);
  } // This is a function to prevent it throwing up in node environments.


  function getCursorAdvanceMethods() {
    return cursorAdvanceMethods || (cursorAdvanceMethods = [IDBCursor.prototype.advance, IDBCursor.prototype.continue, IDBCursor.prototype.continuePrimaryKey]);
  }

  const cursorRequestMap = new WeakMap();
  const transactionDoneMap = new WeakMap();
  const transactionStoreNamesMap = new WeakMap();
  const transformCache = new WeakMap();
  const reverseTransformCache = new WeakMap();

  function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
      const unlisten = () => {
        request.removeEventListener('success', success);
        request.removeEventListener('error', error);
      };

      const success = () => {
        resolve(wrap(request.result));
        unlisten();
      };

      const error = () => {
        reject(request.error);
        unlisten();
      };

      request.addEventListener('success', success);
      request.addEventListener('error', error);
    });
    promise.then(value => {
      // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
      // (see wrapFunction).
      if (value instanceof IDBCursor) {
        cursorRequestMap.set(value, request);
      }
    }); // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.

    reverseTransformCache.set(promise, request);
    return promise;
  }

  function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx)) return;
    const done = new Promise((resolve, reject) => {
      const unlisten = () => {
        tx.removeEventListener('complete', complete);
        tx.removeEventListener('error', error);
        tx.removeEventListener('abort', error);
      };

      const complete = () => {
        resolve();
        unlisten();
      };

      const error = () => {
        reject(tx.error);
        unlisten();
      };

      tx.addEventListener('complete', complete);
      tx.addEventListener('error', error);
      tx.addEventListener('abort', error);
    }); // Cache it for later retrieval.

    transactionDoneMap.set(tx, done);
  }

  let idbProxyTraps = {
    get(target, prop, receiver) {
      if (target instanceof IDBTransaction) {
        // Special handling for transaction.done.
        if (prop === 'done') return transactionDoneMap.get(target); // Polyfill for objectStoreNames because of Edge.

        if (prop === 'objectStoreNames') {
          return target.objectStoreNames || transactionStoreNamesMap.get(target);
        } // Make tx.store return the only store in the transaction, or undefined if there are many.


        if (prop === 'store') {
          return receiver.objectStoreNames[1] ? undefined : receiver.objectStore(receiver.objectStoreNames[0]);
        }
      } // Else transform whatever we get back.


      return wrap(target[prop]);
    },

    has(target, prop) {
      if (target instanceof IDBTransaction && (prop === 'done' || prop === 'store')) return true;
      return prop in target;
    }

  };

  function addTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
  }

  function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
    if (func === IDBDatabase.prototype.transaction && !('objectStoreNames' in IDBTransaction.prototype)) {
      return function (storeNames, ...args) {
        const tx = func.call(unwrap(this), storeNames, ...args);
        transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
        return wrap(tx);
      };
    } // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.


    if (getCursorAdvanceMethods().includes(func)) {
      return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        func.apply(unwrap(this), args);
        return wrap(cursorRequestMap.get(this));
      };
    }

    return function (...args) {
      // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
      // the original object.
      return wrap(func.apply(unwrap(this), args));
    };
  }

  function transformCachableValue(value) {
    if (typeof value === 'function') return wrapFunction(value); // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).

    if (value instanceof IDBTransaction) cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes())) return new Proxy(value, idbProxyTraps); // Return the same value back if we're not going to transform it.

    return value;
  }

  function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest) return promisifyRequest(value); // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.

    if (transformCache.has(value)) return transformCache.get(value);
    const newValue = transformCachableValue(value); // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.

    if (newValue !== value) {
      transformCache.set(value, newValue);
      reverseTransformCache.set(newValue, value);
    }

    return newValue;
  }

  const unwrap = value => reverseTransformCache.get(value);

  /**
   * Open a database.
   *
   * @param name Name of the database.
   * @param version Schema version.
   * @param callbacks Additional callbacks.
   */

  function openDB(name, version, {
    blocked,
    upgrade,
    blocking
  } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);

    if (upgrade) {
      request.addEventListener('upgradeneeded', event => {
        upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
      });
    }

    if (blocked) request.addEventListener('blocked', () => blocked());
    if (blocking) openPromise.then(db => db.addEventListener('versionchange', blocking));
    return openPromise;
  }

  const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
  const writeMethods = ['put', 'add', 'delete', 'clear'];
  const cachedMethods = new Map();

  function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === 'string')) return;
    if (cachedMethods.get(prop)) return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if ( // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))) return;

    const method = async function (storeName, ...args) {
      const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
      let target = tx.store;
      if (useIndex) target = target.index(args.shift());
      const returnVal = target[targetFuncName](...args);
      if (isWrite) await tx.done;
      return returnVal;
    };

    cachedMethods.set(prop, method);
    return method;
  }

  addTraps(oldTraps => ({
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
  }));

  function getDB() {
    return openDB("test-db", "1", {
      upgrade(db) {
        db.createObjectStore("test-store");
        db.createObjectStore("reply-store");
      }

    });
  }

  self.addEventListener("install", function (e) {
    e.waitUntil(_asyncToGenerator(function* () {
      // Add our dummy image to the offline cache. It is then picked up by
      // the fetch event in worker.js
      let cache = yield caches.open("demo-cache");
      yield cache.add("./dummy-image.png");
      self.skipWaiting();
    })());
  });
  function makeExampleOfflineResponse() {
    return _makeExampleOfflineResponse.apply(this, arguments);
  }

  function _makeExampleOfflineResponse() {
    _makeExampleOfflineResponse = _asyncToGenerator(function* () {
      let db = yield getDB();
      let existingCount = (yield db.get("test-store", "increment")) || 0;
      existingCount++;
      yield db.put("test-store", existingCount, "increment");
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
    });
    return _makeExampleOfflineResponse.apply(this, arguments);
  }

  function showThreadedNotification() {
    self.registration.showNotification("A threaded notification", {
      body: "This is an example of how a threaded notification could work",
      tag: "threaded-example",
      actions: [{
        action: "next",
        title: "Next"
      }]
    });
  }
  console.log("setup listener");
  self.addEventListener("notificationclick", function (e) {
    if (e.notification.tag !== "threaded-example") {
      return;
    }

    if (e.action === "close") {
      e.notification.close();
      return;
    }

    self.registration.showNotification("Second threaded notification", {
      tag: "threaded-example",
      body: "Imagine that we might go into more detail in the second screen, while not overwhelming the user on the first.",
      actions: [{
        action: "close",
        title: "Close"
      }]
    });
  });

  let circles = [];
  function canvasRenderFrame(canvas) {
    if (circles.length == 0) {
      addCircle(canvas);
    }

    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    circles.forEach(function (c) {
      moveCircleAtAngle(c, 5, canvas);
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    });
  }
  function addCircle(canvas) {
    circles.push({
      radius: 20 + Math.random() * 30,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.width,
      fill: randomColor(),
      angle: Math.round(Math.random() * 360)
    });
  }

  function randomColor() {
    return "#" + Math.floor(Math.random() * 16777215).toString(16);
  }

  function moveCircleAtAngle(circle, distance, canvas) {
    circle.x = circle.x + Math.sin(circle.angle * Math.PI / 180) * distance;
    circle.y = circle.y + Math.cos(circle.angle * Math.PI / 180) * distance;

    if (circle.x - circle.radius < 0) {
      circle.x = circle.radius;
      circle.angle -= 90;
    } else if (circle.x + circle.radius > canvas.width) {
      circle.x = canvas.width - circle.radius;
      circle.angle -= 90;
    }

    if (circle.y - circle.radius < 0) {
      circle.y = circle.radius;
      circle.angle -= 90;
    } else if (circle.y + circle.radius > canvas.height) {
      circle.y = canvas.height - circle.radius;
      circle.angle -= 90;
    }
  }

  function showCanvasNotification() {
    let body = "canvas" in Notification.prototype ? "This notification uses an approximation of the HTML Canvas API to draw and animate a custom graphic. Tap the button below to add an element." : "This is fallback content for environments where canvas-in-notification is not supported";
    self.registration.showNotification("A Canvas notification", {
      body,
      canvas: {
        proportion: 1
      },
      actions: [{
        action: "add-circle",
        title: "Add circle"
      }]
    });
  }
  self.addEventListener("notificationcanvasframe", function (e) {
    canvasRenderFrame(e.notification.canvas);
    e.notification.canvas.requestAnimationFrame();
  });
  self.addEventListener("notificationclick", function (e) {
    if (e.action != "add-circle") {
      return;
    }

    addCircle(e.notification.canvas);
  });

  const videoURLs = ["https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8", "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8"];
  function showLiveVideoNotification(videoIndex) {
    videoIndex = videoIndex || 0;
    let body = "video" in Notification.prototype ? "This is a live video. Well, it isn't, but it's an example HTTP Live Streaming feed, which is how live video would be delivered.\n\n" + "You can hit the 'switch feeds' button to change the feed being used.\n\n" + `Currently watching feed: ${videoIndex == 1 ? "Two" : "One"}` : "Sorry, live video only works on iOS.";
    self.registration.showNotification("Live video", {
      body,
      tag: "live-video",
      data: {
        videoIndex
      },
      video: {
        preload: false,
        url: videoURLs[videoIndex]
      },
      actions: [{
        action: "switch-feed",
        title: "Switch feed"
      }]
    });
  }
  self.addEventListener("notificationclick", function (e) {
    if (e.action !== "switch-feed") {
      return;
    }

    let videoIndex = e.notification.data.videoIndex == 0 ? 1 : 0;
    showLiveVideoNotification(videoIndex);
  });

  function showTextReplyNotification() {
    self.registration.showNotification("Text reply notification", {
      body: "You can use this to receive a response directly from the reader. Perhaps in response to asking them a question?",
      tag: "text-reply",
      actions: [{
        title: "Reply",
        action: "reply",
        type: "text",
        buttonText: "Send"
      }]
    });
  }
  self.addEventListener("notificationclick", function (e) {
    e.waitUntil(_asyncToGenerator(function* () {
      if (e.notification.tag !== "text-reply" || e.action !== "reply" || !e.reply) {
        return;
      }

      let db = yield getDB();
      let existing = (yield db.get("reply-store", "replies")) || [];
      existing.push(e.reply);
      yield db.put("reply-store", existing, "replies");
      e.notification.close();
    })());
  });
  function makeStoredRepliesResponse() {
    return _makeStoredRepliesResponse.apply(this, arguments);
  }

  function _makeStoredRepliesResponse() {
    _makeStoredRepliesResponse = _asyncToGenerator(function* () {
      let db = yield getDB();
      let replies = (yield db.get("reply-store", "replies")) || [];
      let repliesAsHTML = replies.map(r => `<li>${r}</li>`).join("");

      if (replies.length == 0) {
        repliesAsHTML = "<p>You have not sent any replies.</p>";
      }

      return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Your Replies</title>
        <meta name="theme-color" content="#8888ff">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
        body {
          font-family: sans-serif;
        }
        </style>
      </head>
      <body>
      <h1>Replies you've sent</h1>
      <p>We track the replies sent through the notifications in local storage. In reality, you'd
        probably want to use fetch() to send them to a remote URL, but for demo purposes, here they are:</p>
        ${repliesAsHTML}
      </body>
    </html> 
  `;
    });
    return _makeStoredRepliesResponse.apply(this, arguments);
  }

  self.addEventListener("activate", function (e) {
    e.waitUntil(self.clients.claim());
  });
  self.addEventListener("fetch", function (e) {
    e.respondWith(_asyncToGenerator(function* () {
      let cacheMatch = yield caches.match(e.request);

      if (cacheMatch) {
        // for this demo, this only happens when the browser tries to
        // load dummy-image.png
        return cacheMatch;
      }

      if (e.request.url.endsWith("/offline-page.html")) {
        return new Response((yield makeExampleOfflineResponse()), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      } else if (e.request.url.endsWith("/replies.html")) {
        return new Response((yield makeStoredRepliesResponse()), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      } // Otherwise make a normal request


      return fetch(e.request);
    })());
  });
  self.addEventListener("message", function (msg) {
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

}());
