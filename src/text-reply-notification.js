import { getDB } from "./db";

export function showTextReplyNotification() {
  self.registration.showNotification("Text reply notification", {
    body:
      "You can use this to receive a response directly from the reader. Perhaps in response to asking them a question?",
    tag: "text-reply",
    actions: [
      {
        title: "Reply",
        action: "reply",
        type: "text",
        buttonText: "Send"
      }
    ]
  });
}

self.addEventListener("notificationclick", function(e) {
  e.waitUntil(
    (async function() {
      if (
        e.notification.tag !== "text-reply" ||
        e.action !== "reply" ||
        !e.reply
      ) {
        return;
      }
      let db = await getDB();
      let existing = (await db.get("reply-store", "replies")) || [];
      existing.push(e.reply);
      await db.put("reply-store", existing, "replies");
      e.notification.close();
    })()
  );
});

export async function makeStoredRepliesResponse() {
  let db = await getDB();
  let replies = (await db.get("reply-store", "replies")) || [];

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
}
