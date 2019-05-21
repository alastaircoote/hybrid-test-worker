import nodeResolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import copy from "rollup-plugin-copy";

export default [
  {
    input: "src/worker.js",
    output: {
      format: "iife",
      file: "dist/worker.js"
    },
    plugins: [
      nodeResolve({}),
      babel(),
      copy({
        targets: ["src/index.html", "src/canvas.html", "src/dummy-image.png"],
        outputFolder: "dist"
      })
    ]
  },
  {
    input: "src/canvas-client.js",
    output: {
      format: "iife",
      file: "dist/canvas-client.js"
    },
    plugins: [nodeResolve({}), babel()]
  }
];
