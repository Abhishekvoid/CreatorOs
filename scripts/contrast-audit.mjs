/**
 * Design-token contrast audit. Converts the OKLCH palette to sRGB and logs
 * WCAG ratios for every text/background pair the UI actually uses.
 * Run: node scripts/contrast-audit.mjs
 */

/* ---- OKLCH -> sRGB ---- */
function oklchToSrgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toGamma = (c) => {
    c = Math.min(1, Math.max(0, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return [toGamma(r), toGamma(g), toGamma(bl)];
}

function luminance([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");

/* ---- proposed palette (L 0-1, C, H deg) — keep in sync with globals.css ---- */
const tokens = {
  cream: [0.977, 0.006, 80],
  cream2: [0.948, 0.01, 80],
  paper: [1, 0, 0],
  ink: [0.235, 0.012, 80],
  ink2: [0.37, 0.012, 80],
  muted: [0.51, 0.012, 80],
  faint: [0.55, 0.012, 80],
  line: [0.905, 0.011, 80],
  line2: [0.872, 0.012, 80],
  terra: [0.575, 0.165, 38],
  terraDeep: [0.495, 0.15, 38],
  amber: [0.78, 0.13, 70],
  green: [0.55, 0.11, 165],
  greenSoft: [0.945, 0.028, 165],
  greenDeep: [0.45, 0.1, 165],
  white: [1, 0, 0],
  amberSoft: [0.955, 0.03, 85], // chip bg (was #FDF3DF)
  amberInk: [0.46, 0.09, 75],   // text on amberSoft (was #9A6A14)
};

const rgb = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, oklchToSrgb(...v)]));

const pairs = [
  ["body text", "ink", "cream", 4.5],
  ["secondary text", "ink2", "cream", 4.5],
  ["muted text", "muted", "cream", 4.5],
  ["muted on paper", "muted", "paper", 4.5],
  ["faint small labels", "faint", "cream", 4.5],
  ["faint on paper", "faint", "paper", 4.5],
  ["saffron CTA label", "white", "terra", 4.5],
  ["saffron deep text", "terraDeep", "cream", 4.5],
  ["ink btn label", "cream", "ink", 4.5],
  ["money text", "greenDeep", "greenSoft", 4.5],
  ["money on cream", "green", "cream", 3],
  ["amber chip text", "amberInk", "amberSoft", 4.5],
  ["hairline border vs cream (non-text)", "line", "cream", 1.2],
];

console.log("token            sRGB");
for (const [k, v] of Object.entries(rgb)) console.log(`${k.padEnd(16)} ${hex(v)}`);
console.log("\npair                                   ratio   need   ok");
let fail = 0;
for (const [name, fg, bg, need] of pairs) {
  const r = ratio(rgb[fg], rgb[bg]);
  const ok = r >= need;
  if (!ok) fail++;
  console.log(`${name.padEnd(38)} ${r.toFixed(2).padStart(5)}   ${String(need).padStart(4)}   ${ok ? "PASS" : "FAIL"}`);
}
process.exit(fail ? 1 : 0);
