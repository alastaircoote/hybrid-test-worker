const videoURLs = [
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
  "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8"
];

export function showLiveVideoNotification(videoIndex) {
  videoIndex = videoIndex || 0;

  let body =
    "video" in Notification.prototype
      ? "This is a live video. Well, it isn't, but it's an example HTTP Live Streaming feed, which is how live video would be delivered.\n\n" +
        "You can hit the 'switch feeds' button to change the feed being used.\n\n" +
        `Currently watching feed: ${videoIndex == 1 ? "Two" : "One"}`
      : "Sorry, live video only works on iOS.";

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
    actions: [
      {
        action: "switch-feed",
        title: "Switch feed"
      }
    ]
  });
}

self.addEventListener("notificationclick", function(e) {
  if (e.action !== "switch-feed") {
    return;
  }

  let videoIndex = e.notification.data.videoIndex == 0 ? 1 : 0;

  showLiveVideoNotification(videoIndex);
});
