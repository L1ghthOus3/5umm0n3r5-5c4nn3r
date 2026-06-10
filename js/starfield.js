// Animated pixel-star background drawn on a canvas.

export function startStarField(canvas) {
  const ctx = canvas.getContext("2d");
  let raf, w, h, dpr;
  const stars = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    stars.length = 0;
    const count = Math.floor((innerWidth * innerHeight) / 9000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        s: (Math.random() * 1.6 + 0.4) * dpr,
        v: (Math.random() * 0.25 + 0.05) * dpr,
        tw: Math.random() * Math.PI * 2,
        hue: 195 + Math.random() * 40,
      });
    }
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (const st of stars) {
      st.y += st.v;
      if (st.y > h) { st.y = -2; st.x = Math.random() * w; }
      const a = 0.35 + Math.abs(Math.sin(st.tw + t / 900)) * 0.5;
      ctx.fillStyle = `hsla(${st.hue},90%,70%,${a})`;
      // pixel squares
      ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
    }
    raf = requestAnimationFrame(frame);
  }

  resize();
  raf = requestAnimationFrame(frame);
  addEventListener("resize", resize);
  return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
}
