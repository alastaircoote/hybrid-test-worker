(function () {
  'use strict';

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

  let canvas = document.getElementById("demo-canvas");
  canvas.width = canvas.height = canvas.clientWidth * window.devicePixelRatio;

  function render() {
    canvasRenderFrame(canvas);
    requestAnimationFrame(render);
  }

  render();
  document.getElementById("add-circle").addEventListener("click", function () {
    addCircle(canvas);
  });

}());
