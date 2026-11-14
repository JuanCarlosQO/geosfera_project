// 3D medication models drawn with CSS only: a stack of thin layers gives each shape real
// thickness, so it can turn in space and be dragged round. They are ILLUSTRATIONS of the
// dose form (tablet, caplet, spray, cream packet), not pictures of the real products; the
// screen says so.

export const FORMS = {
  tablet: "round tablet",
  caplet: "oblong tablet",
  spray: "nasal spray bottle",
  packet: "single-dose cream packet"
};

const LAYERS = 11;

export function pill3d(med, size = 76) {
  const mid = (LAYERS - 1) / 2;
  const layers = Array.from({ length: LAYERS }, (_, i) => `<i style="--z:${i - mid}"></i>`).join("");
  return `<span class="pill3d" data-form="${med.form}" style="--tint:${med.tint};--s:${size}px" role="img" aria-label="3D illustration: ${FORMS[med.form]}">
    <span class="p3-spin">${layers}</span><span class="p3-shadow" aria-hidden="true"></span></span>`;
}

/** Lets the crew member drag any model inside `root` to turn it. */
export function enableDrag(root) {
  let held = null;
  root.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".pill3d");
    if (!el) return;
    const spin = el.querySelector(".p3-spin");
    held = { el, spin, x: e.clientX, y: e.clientY, ry: Number(spin.dataset.ry ?? 25), rx: Number(spin.dataset.rx ?? -20) };
    el.classList.add("held");
    el.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener("pointermove", (e) => {
    if (!held) return;
    const ry = held.ry + (e.clientX - held.x) * 1.2;
    const rx = Math.max(-80, Math.min(80, held.rx - (e.clientY - held.y) * 1.2));
    held.spin.dataset.ry = ry;
    held.spin.dataset.rx = rx;
    held.spin.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  const drop = () => { held = null; };
  root.addEventListener("pointerup", drop);
  root.addEventListener("pointercancel", drop);
}
