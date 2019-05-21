import { openDB, deleteDB, wrap, unwrap } from "idb";

export function getDB() {
  return openDB("test-db", "1", {
    upgrade(db) {
      db.createObjectStore("test-store");
      db.createObjectStore("reply-store");
    }
  });
}
