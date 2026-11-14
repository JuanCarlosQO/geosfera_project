// Module 2 — Ergosphere's own anatomical figure, drawn for this project (no third-party artwork).
// Front view, anatomical position, about eight heads tall. The person's left is on the viewer's right.
// Every region has a data-region so a body system can light it.

export const REGIONS = ["brain", "eyes", "halo", "heart", "vessels", "lungs", "gut", "skeleton", "skin"];

const MIRROR = 'transform="matrix(-1 0 0 1 200 0)"';

/** Smooth closed outline through points (Catmull-Rom to cubic Bézier). */
function smooth(points, closed = true) {
  const p = closed ? [points.at(-1), ...points, points[0], points[1]] : [points[0], ...points, points.at(-1)];
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < p.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return closed ? `${d} Z` : d;
}

// Right half of the body (viewer's right), from the neck down and back up the inner leg.
const HALF = [
  [108, 57], [110, 68], [122, 74], [137, 78], [146, 86], [150, 98], [152, 121], [154, 145], [156, 168],
  [158, 192], [162, 217], [164, 235], [168, 251], [169, 267], [165, 281], [160, 287], [155, 283],
  [153, 267], [152, 251], [151, 238], [146, 212], [141, 188], [138, 166], [135, 140], [130, 113],
  [131, 129], [129, 151], [126, 168], [130, 186], [134, 204], [135, 223], [133, 251], [130, 280],
  [126, 306], [127, 330], [129, 351], [125, 378], [121, 398], [119, 408], [124, 418], [126, 427],
  [118, 432], [108, 431], [107, 420], [108, 404], [106, 380], [107, 352], [105, 330], [106, 306],
  [105, 276], [103, 248], [100, 233]
];
const BODY = [...HALF, ...HALF.slice(0, -1).reverse().map(([x, y]) => [200 - x, y])];

const HEAD = smooth([[100, 9], [112, 12], [119, 22], [120, 35], [117, 46], [111, 55], [100, 59], [89, 55], [83, 46], [80, 35], [81, 22], [88, 12]]);

function ribs() {
  let d = "";
  for (let i = 0; i < 10; i += 1) {
    const y = 86 + i * 6.4;
    const w = 25 - Math.abs(i - 4.5) * 1.5;
    d += `M101 ${y} Q${(100 + w).toFixed(1)} ${(y - 5).toFixed(1)} ${(98 + w).toFixed(1)} ${(y + 9).toFixed(1)} `;
  }
  return d;
}

function vertebrae() {
  let s = "";
  for (let y = 60; y <= 226; y += 6.6) s += `<rect x="97.4" y="${y.toFixed(1)}" width="5.2" height="4.6" rx="1.4"/>`;
  return s;
}

const RIGHT_LIMB_BONES = `
  <path d="M100 79 Q118 76 136 82"/>
  <path d="M137 84 Q144 96 140 108 Q132 112 128 100"/>
  <line x1="144" y1="92" x2="150" y2="164"/><circle cx="144" cy="91" r="4.2"/><circle cx="150" cy="167" r="3"/>
  <line x1="148" y1="171" x2="156" y2="234"/><line x1="153" y1="170" x2="161" y2="233"/>
  <path d="M157 238 L159 266 M160 238 L163 268 M163 238 L166 265 M166 239 L168 258 M155 240 L154 256"/>
  <path d="M100 200 C112 188 129 192 131 208 C130 220 118 228 108 232"/>
  <line x1="121" y1="226" x2="117" y2="303"/><circle cx="121" cy="225" r="5"/><circle cx="116" cy="309" r="4.2"/>
  <line x1="115" y1="316" x2="114" y2="402"/><line x1="121" y1="318" x2="120" y2="398"/>
  <path d="M114 406 L112 428 M117 406 L117 430 M120 405 L122 427"/>`;

const BRAIN = `
  <path d="M100 14 C112 14 117 21 117 29 C117 36 111 40 100 40 C89 40 83 36 83 29 C83 21 88 14 100 14 Z"/>
  <path class="detail" d="M100 15 V39 M88 22 Q92 25 89 29 Q93 32 90 35 M112 22 Q108 25 111 29 Q107 32 110 35 M94 18 Q96 22 93 25 M106 18 Q104 22 107 25"/>`;

const LUNGS = `
  <path d="M97 86 C88 86 79 93 76 108 C73 124 74 138 78 146 C86 149 93 148 97 144 C98 126 98 104 97 86 Z"/>
  <path d="M103 86 C112 86 121 93 124 108 C127 124 126 138 122 146 C115 149 109 147 106 141 C110 134 110 126 104 120 C104 108 103 96 103 86 Z"/>
  <path class="detail" d="M100 78 V90 M100 90 Q94 96 90 104 M100 90 Q106 96 110 104"/>`;

const HEART = `
  <path d="M103 112 C99 107 92 110 93 117 C94 125 102 131 108 136 C115 130 121 124 120 116 C119 109 111 108 108 113 C106 110 104 111 103 112 Z"/>`;

const VESSELS = `
  <path d="M104 112 C102 100 106 94 111 96 C114 98 113 104 110 108"/>
  <path d="M101 112 V214 M101 214 L114 236 L116 300 M101 214 L88 236 L84 300 M96 60 V96 M104 60 V96"/>`;

const GUT = `
  <path d="M78 146 C88 144 100 146 104 149 C103 157 98 163 88 166 C82 167 78 163 77 156 Z"/>
  <path d="M106 149 C114 147 122 150 123 157 C122 166 115 172 107 170 C104 165 104 156 106 149 Z"/>
  <path d="M84 174 C92 170 108 170 116 174 C120 182 118 190 112 191 C104 186 96 186 88 191 C82 190 80 182 84 174 Z M88 194 C96 190 104 190 112 194 C114 202 110 210 100 212 C90 210 86 202 88 194 Z"/>
  <ellipse cx="87" cy="180" rx="4" ry="7" class="detail"/><ellipse cx="113" cy="180" rx="4" ry="7" class="detail"/>`;

const EYES = `<ellipse cx="93" cy="33" rx="3.6" ry="2.4"/><ellipse cx="107" cy="33" rx="3.6" ry="2.4"/>`;

// Surface anatomy on the viewer's right half (mirrored for the left): pectoral, deltoid,
// abdominal line, oblique, biceps, quadriceps, knee and calf.
const CONTOURS = `
  <path d="M101 92 C110 90 122 92 128 100 C126 110 116 114 104 112"/>
  <path d="M136 82 C144 86 148 94 148 104"/>
  <path d="M104 120 V200 M104 136 H116 M104 152 H117 M104 168 H117"/>
  <path d="M124 150 C122 168 120 184 118 196"/>
  <path d="M146 112 C150 124 151 136 150 150"/>
  <path d="M112 232 C122 250 126 268 124 292"/>
  <path d="M112 300 C118 304 122 304 124 300 M110 318 C116 322 122 320 124 316"/>
  <path d="M126 336 C128 350 126 364 122 378"/>`;

export function figureSvg() {
  const body = smooth(BODY);
  return `
<svg class="figure" viewBox="0 0 200 450" role="img" aria-label="Hologram of a human body showing the skeleton and main organs">
  <defs>
    <clipPath id="fig-clip"><path d="${body}"/><path d="${HEAD}"/></clipPath>
    <linearGradient id="fig-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6fe3ff" stop-opacity=".22"/><stop offset="1" stop-color="#2a7bd6" stop-opacity=".06"/>
    </linearGradient>
    <radialGradient id="ring-glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#6fe3ff" stop-opacity=".55"/><stop offset=".6" stop-color="#2a7bd6" stop-opacity=".18"/><stop offset="1" stop-color="#2a7bd6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g class="ring" aria-hidden="true">
    <ellipse cx="100" cy="433" rx="86" ry="16" fill="url(#ring-glow)"/>
    <ellipse cx="100" cy="433" rx="70" ry="11" class="ring-line"/>
    <ellipse cx="100" cy="433" rx="78" ry="13.5" class="ring-dots"/>
    <ellipse cx="100" cy="433" rx="56" ry="8" class="ring-line faint"/>
  </g>

  <g class="region" data-region="halo"><ellipse cx="100" cy="32" rx="34" ry="34" class="halo"/></g>

  <g class="region skin" data-region="skin">
    <path d="${body}" class="shell" pathLength="1"/>
    <path d="${HEAD}" class="shell" pathLength="1"/>
    <g class="contour">${CONTOURS}</g>
    <g ${MIRROR} class="contour">${CONTOURS}</g>
  </g>

  <g class="region bones" data-region="skeleton">
    <path d="M100 13 C113 13 119 23 118 35 C117 44 112 49 106 50 L94 50 C88 49 83 44 82 35 C81 23 87 13 100 13 Z"/>
    <path d="M89 47 Q100 60 111 47"/>
    <rect x="96" y="82" width="8" height="44" rx="3"/>
    <path d="${ribs()}"/>
    <g ${MIRROR}><path d="${ribs()}"/></g>
    ${vertebrae()}
    <path d="M94 204 L106 204 L100 226 Z"/>
    <g>${RIGHT_LIMB_BONES}</g>
    <g ${MIRROR}>${RIGHT_LIMB_BONES}</g>
  </g>

  <g class="region organ" data-region="brain">${BRAIN}</g>
  <g class="region organ" data-region="eyes">${EYES}</g>
  <g class="region organ" data-region="lungs">${LUNGS}</g>
  <g class="region organ" data-region="gut">${GUT}</g>
  <g class="region organ" data-region="vessels">${VESSELS}</g>
  <g class="region organ" data-region="heart">${HEART}</g>

  <g clip-path="url(#fig-clip)" aria-hidden="true"><rect class="scan" x="0" y="0" width="200" height="8"/></g>
</svg>`;
}

/** Small filled silhouette (body + head) for crew cards, same proportions as the hologram. */
export function silhouetteSvg(cls = "") {
  return `<svg class="silhouette ${cls}" viewBox="0 0 200 450" aria-hidden="true"><path d="${smooth(BODY)}"/><path d="${HEAD}"/></svg>`;
}
