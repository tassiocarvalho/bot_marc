/**
 * Arte das figurinhas do /pet: gatos e cachorros desenhados em SVG
 * e convertidos para WebP 512x512 pelo sharp. Cada humor muda olhos,
 * boca e enfeites; o nível adiciona acessórios (laço/bandana, coroa).
 *
 * @author bot_marc
 */
import sharp from "sharp";

export const PET_COLORS = {
  gato: {
    laranja: { fur: "#F4A341", dark: "#D9822B", light: "#FFE6C7" },
    cinza: { fur: "#A3ACB8", dark: "#78818D", light: "#ECEFF3" },
    preto: { fur: "#3B3B46", dark: "#23232B", light: "#6E6E7C" },
    branco: { fur: "#F8F5F0", dark: "#D8D0C4", light: "#FFFFFF" },
    siames: { fur: "#F1E2CC", dark: "#6B4A3A", light: "#FFF7EA" },
  },
  cachorro: {
    caramelo: { fur: "#DDA468", dark: "#B07A43", light: "#F8E4C8" },
    marrom: { fur: "#8E5D3F", dark: "#68412A", light: "#DDB998" },
    preto: { fur: "#3B3B46", dark: "#23232B", light: "#8A8A98" },
    branco: { fur: "#F8F5F0", dark: "#D8D0C4", light: "#FFFFFF" },
    dourado: { fur: "#E9B949", dark: "#C08F25", light: "#FBEBC0" },
  },
};

export const PET_MOODS = [
  "feliz",
  "fome",
  "sono",
  "triste",
  "comendo",
  "brincando",
  "sujo",
  "banho",
  "amor",
  "passeio",
];

const INK = "#2B2B33";
const PINK = "#F28CA0";
const MOUTH = "#7A2E3A";

const escapeXml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const heart = (x, y, size, color = "#FF5C7A") => {
  const s = size / 20;
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C0 -2 -12 -4 -12 4 C-12 10 -4 14 0 20 C4 14 12 10 12 4 C12 -4 0 -2 0 6 Z" fill="${color}"/>`;
};

const star = (cx, cy, r, color = "#FFD43B") => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `<polygon points="${points.join(" ")}" fill="${color}" stroke="#E0A800" stroke-width="3" stroke-linejoin="round"/>`;
};

const sparkle = (cx, cy, r, color = "#FFFFFF") =>
  `<path d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z" fill="${color}" stroke="#FFC94D" stroke-width="2"/>`;

const fish = (x, y, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-38 0 Q-10 -26 22 0 Q-10 26 -38 0 Z" fill="#6EC1E4" stroke="${INK}" stroke-width="4"/>
    <path d="M20 0 L42 -16 L42 16 Z" fill="#6EC1E4" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="-22" cy="-4" r="4" fill="${INK}"/>
  </g>`;

const bone = (x, y, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-30" y="-9" width="60" height="18" rx="6" fill="#FFF8EC" stroke="${INK}" stroke-width="4"/>
    <circle cx="-32" cy="-10" r="11" fill="#FFF8EC" stroke="${INK}" stroke-width="4"/>
    <circle cx="-32" cy="10" r="11" fill="#FFF8EC" stroke="${INK}" stroke-width="4"/>
    <circle cx="32" cy="-10" r="11" fill="#FFF8EC" stroke="${INK}" stroke-width="4"/>
    <circle cx="32" cy="10" r="11" fill="#FFF8EC" stroke="${INK}" stroke-width="4"/>
    <rect x="-28" y="-6" width="56" height="12" fill="#FFF8EC"/>
  </g>`;

const food = (species, x, y, scale) => (species === "gato" ? fish(x, y, scale) : bone(x, y, scale));

function eyes(mood) {
  const L = 195;
  const R = 317;
  const Y = 238;
  const openEye = (x) =>
    `<ellipse cx="${x}" cy="${Y}" rx="23" ry="29" fill="${INK}"/>
     <circle cx="${x + 8}" cy="${Y - 10}" r="8" fill="#fff"/>
     <circle cx="${x - 7}" cy="${Y + 9}" r="4" fill="#fff"/>`;
  const happy = (x) =>
    `<path d="M${x - 22} ${Y + 8} Q${x} ${Y - 22} ${x + 22} ${Y + 8}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`;
  const closed = (x) =>
    `<path d="M${x - 22} ${Y} Q${x} ${Y + 16} ${x + 22} ${Y}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`;

  switch (mood) {
    case "feliz":
    case "comendo":
    case "banho":
      return happy(L) + happy(R);
    case "sono":
      return closed(L) + closed(R);
    case "amor":
      return heart(L, Y - 22, 46) + heart(R, Y - 22, 46);
    case "brincando":
      return star(L, Y, 30) + star(R, Y, 30);
    case "triste":
      return (
        openEye(L) +
        openEye(R) +
        `<path d="M${L - 26} ${Y - 36} L${L + 18} ${Y - 50}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
         <path d="M${R + 26} ${Y - 36} L${R - 18} ${Y - 50}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
         <path d="M${L - 4} ${Y + 32} Q${L - 16} ${Y + 56} ${L - 4} ${Y + 64} Q${L + 8} ${Y + 56} ${L - 4} ${Y + 32} Z" fill="#7CC8FF" stroke="#3E9BE0" stroke-width="3"/>`
      );
    case "fome":
      return (
        `<ellipse cx="${L}" cy="${Y}" rx="27" ry="33" fill="${INK}"/><circle cx="${L + 9}" cy="${Y - 11}" r="11" fill="#fff"/><circle cx="${L - 8}" cy="${Y + 10}" r="5" fill="#fff"/>` +
        `<ellipse cx="${R}" cy="${Y}" rx="27" ry="33" fill="${INK}"/><circle cx="${R + 9}" cy="${Y - 11}" r="11" fill="#fff"/><circle cx="${R - 8}" cy="${Y + 10}" r="5" fill="#fff"/>`
      );
    default:
      return openEye(L) + openEye(R);
  }
}

function mouth(species, mood) {
  const smallSmile =
    species === "gato"
      ? `<path d="M230 300 Q243 316 256 300 Q269 316 282 300" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`
      : `<path d="M226 312 Q241 330 256 314 Q271 330 286 312" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  const openSmile = `<path d="M222 304 Q256 356 290 304 Z" fill="${MOUTH}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <ellipse cx="256" cy="330" rx="16" ry="11" fill="${PINK}"/>`;

  switch (mood) {
    case "feliz":
    case "brincando":
    case "passeio":
      return species === "cachorro"
        ? openSmile + `<path d="M242 330 Q256 372 270 330 Z" fill="${PINK}" stroke="${INK}" stroke-width="5"/>`
        : openSmile;
    case "triste":
    case "sujo":
      return `<path d="M228 326 Q256 300 284 326" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
    case "fome":
      return (
        `<ellipse cx="256" cy="318" rx="13" ry="15" fill="${MOUTH}" stroke="${INK}" stroke-width="5"/>` +
        `<path d="M276 322 Q271 342 278 350 Q286 342 280 322 Z" fill="#9AD8FF" stroke="#3E9BE0" stroke-width="3"/>`
      );
    case "sono":
      return `<ellipse cx="256" cy="316" rx="9" ry="11" fill="${MOUTH}"/>`;
    case "comendo":
      return `<path d="M228 304 Q256 340 284 304 Z" fill="${MOUTH}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
    default:
      return smallSmile;
  }
}

function extras(species, mood) {
  switch (mood) {
    case "sono":
      return `<g fill="none" stroke="#6C7BD8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M372 120 L410 120 L372 160 L410 160"/>
        <path d="M424 70 L452 70 L424 100 L452 100"/>
        <path d="M462 32 L482 32 L462 54 L482 54"/>
      </g>`;
    case "amor":
      return heart(90, 90, 54) + heart(420, 70, 40) + heart(450, 170, 30) + heart(70, 200, 28);
    case "fome":
      return `<circle cx="372" cy="130" r="9" fill="#fff" stroke="${INK}" stroke-width="4"/>
        <circle cx="392" cy="102" r="14" fill="#fff" stroke="${INK}" stroke-width="4"/>
        <ellipse cx="438" cy="58" rx="62" ry="44" fill="#fff" stroke="${INK}" stroke-width="5"/>
        ${food(species, 438, 58, 0.95)}`;
    case "comendo":
      return `${food(species, 256, 352, 1.05)}
        <circle cx="200" cy="372" r="5" fill="#E9B97A"/><circle cx="318" cy="380" r="4" fill="#E9B97A"/><circle cx="300" cy="396" r="5" fill="#E9B97A"/>`;
    case "brincando":
      return `<g transform="translate(428 418)">
          <circle r="40" fill="#FF6B6B" stroke="${INK}" stroke-width="5"/>
          <path d="M-38 -10 Q0 18 38 -10" fill="none" stroke="#fff" stroke-width="8"/>
          <path d="M-30 22 Q0 40 30 22" fill="none" stroke="#FFD43B" stroke-width="7"/>
        </g>
        <g stroke="${INK}" stroke-width="6" stroke-linecap="round"><path d="M462 340 L486 322"/><path d="M478 372 L500 362"/></g>
        ${sparkle(80, 110, 22)}${sparkle(440, 120, 16)}`;
    case "sujo":
      return `<g fill="#8B6A4E" opacity="0.85">
          <ellipse cx="170" cy="180" rx="26" ry="18"/><ellipse cx="335" cy="320" rx="20" ry="14"/>
          <ellipse cx="300" cy="170" rx="14" ry="10"/><ellipse cx="190" cy="410" rx="30" ry="18"/>
          <ellipse cx="330" cy="430" rx="22" ry="14"/>
        </g>
        <g stroke="${INK}" stroke-width="3">
          <circle cx="420" cy="120" r="7" fill="${INK}"/><ellipse cx="413" cy="110" rx="8" ry="5" fill="#E8F4FF"/><ellipse cx="428" cy="110" rx="8" ry="5" fill="#E8F4FF"/>
          <circle cx="90" cy="150" r="6" fill="${INK}"/><ellipse cx="84" cy="141" rx="7" ry="4" fill="#E8F4FF"/><ellipse cx="97" cy="141" rx="7" ry="4" fill="#E8F4FF"/>
        </g>
        <g fill="none" stroke="#7F8C8D" stroke-width="4" stroke-linecap="round"><path d="M440 150 q8 -10 0 -20 q-8 -10 0 -20"/><path d="M70 190 q8 -10 0 -20 q-8 -10 0 -20"/></g>`;
    case "banho": {
      const bubble = (x, y, r) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="#CFEFFF" fill-opacity="0.55" stroke="#62B6E8" stroke-width="4"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 4}" fill="#fff"/>`;
      return `<g fill="#fff" stroke="#BFD9EA" stroke-width="4">
          <circle cx="200" cy="120" r="38"/><circle cx="256" cy="98" r="46"/><circle cx="314" cy="120" r="38"/><circle cx="232" cy="134" r="30"/><circle cx="286" cy="136" r="30"/>
        </g>
        ${bubble(76, 160, 30)}${bubble(440, 200, 36)}${bubble(452, 96, 20)}${bubble(70, 330, 22)}${bubble(452, 330, 26)}${bubble(110, 70, 16)}`;
    }
    case "passeio":
      return `<g transform="translate(420 82)">
          <circle r="40" fill="#FFD43B" stroke="#F0A500" stroke-width="5"/>
          <g stroke="#F0A500" stroke-width="7" stroke-linecap="round">
            <path d="M0 -56 L0 -70"/><path d="M0 56 L0 70"/><path d="M-56 0 L-70 0"/><path d="M56 0 L70 0"/>
            <path d="M40 40 L50 50"/><path d="M-40 -40 L-50 -50"/><path d="M40 -40 L50 -50"/><path d="M-40 40 L-50 50"/>
          </g>
        </g>
        <path d="M256 362 C300 380 380 330 470 250" fill="none" stroke="#E64980" stroke-width="9" stroke-linecap="round"/>
        <g fill="#69DB7C"><path d="M40 470 q10 -40 20 0 Z"/><path d="M60 470 q12 -50 24 0 Z"/><path d="M440 470 q10 -40 20 0 Z"/></g>`;
    case "feliz":
      return sparkle(84, 120, 24) + sparkle(436, 110, 18) + sparkle(460, 200, 12);
    default:
      return "";
  }
}

function accessories(species, level) {
  let svg = "";

  if (level >= 5) {
    svg +=
      species === "gato"
        ? `<g transform="translate(330 140) rotate(18)">
            <path d="M0 0 L-38 -24 L-38 24 Z" fill="#FF6FA5" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
            <path d="M0 0 L38 -24 L38 24 Z" fill="#FF6FA5" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
            <circle r="11" fill="#FF3D86" stroke="${INK}" stroke-width="5"/>
          </g>`
        : `<path d="M176 352 Q256 380 336 352 L256 420 Z" fill="#E03131" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
           <circle cx="236" cy="372" r="5" fill="#fff"/><circle cx="272" cy="378" r="5" fill="#fff"/><circle cx="256" cy="398" r="4" fill="#fff"/>`;
  }

  if (level >= 10) {
    svg += `<g transform="translate(256 112)">
        <path d="M-56 30 L-64 -26 L-30 4 L0 -40 L30 4 L64 -26 L56 30 Z" fill="#FFD43B" stroke="#C99400" stroke-width="5" stroke-linejoin="round"/>
        <circle cx="0" cy="8" r="9" fill="#FF6B6B"/><circle cx="-34" cy="16" r="6" fill="#4DABF7"/><circle cx="34" cy="16" r="6" fill="#4DABF7"/>
      </g>`;
  }

  if (level >= 20) {
    svg += sparkle(60, 300, 18, "#FFF3BF") + sparkle(452, 290, 20, "#FFF3BF") + sparkle(130, 40, 14, "#FFF3BF");
  }

  return svg;
}

function catBody(c) {
  return `<path d="M372 420 C450 410 470 330 432 290" fill="none" stroke="${c.dark}" stroke-width="34" stroke-linecap="round"/>
    <path d="M372 420 C450 410 470 330 432 290" fill="none" stroke="${c.fur}" stroke-width="22" stroke-linecap="round"/>
    <ellipse cx="256" cy="400" rx="132" ry="86" fill="${c.fur}" stroke="${c.dark}" stroke-width="6"/>
    <ellipse cx="256" cy="412" rx="70" ry="56" fill="${c.light}"/>
    <ellipse cx="198" cy="468" rx="40" ry="22" fill="${c.light}" stroke="${c.dark}" stroke-width="5"/>
    <ellipse cx="314" cy="468" rx="40" ry="22" fill="${c.light}" stroke="${c.dark}" stroke-width="5"/>
    <path d="M130 196 L146 64 L240 142 Z" fill="${c.fur}" stroke="${c.dark}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M382 196 L366 64 L272 142 Z" fill="${c.fur}" stroke="${c.dark}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M150 170 L158 98 L214 146 Z" fill="${PINK}"/>
    <path d="M362 170 L354 98 L298 146 Z" fill="${PINK}"/>
    <ellipse cx="256" cy="252" rx="152" ry="130" fill="${c.fur}" stroke="${c.dark}" stroke-width="6"/>
    <path d="M226 126 L236 166 M256 122 L256 164 M286 126 L276 166" stroke="${c.dark}" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="256" cy="304" rx="64" ry="42" fill="${c.light}"/>
    <path d="M243 278 L269 278 L256 293 Z" fill="${PINK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <g stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity="0.7">
      <path d="M150 286 L86 272"/><path d="M150 302 L84 308"/>
      <path d="M362 286 L426 272"/><path d="M362 302 L428 308"/>
    </g>`;
}

function dogBody(c) {
  return `<path d="M370 400 Q430 370 440 320" fill="none" stroke="${c.dark}" stroke-width="32" stroke-linecap="round"/>
    <path d="M370 400 Q430 370 440 320" fill="none" stroke="${c.fur}" stroke-width="20" stroke-linecap="round"/>
    <ellipse cx="256" cy="400" rx="134" ry="86" fill="${c.fur}" stroke="${c.dark}" stroke-width="6"/>
    <ellipse cx="256" cy="414" rx="72" ry="56" fill="${c.light}"/>
    <ellipse cx="198" cy="468" rx="42" ry="23" fill="${c.light}" stroke="${c.dark}" stroke-width="5"/>
    <ellipse cx="314" cy="468" rx="42" ry="23" fill="${c.light}" stroke="${c.dark}" stroke-width="5"/>
    <ellipse cx="256" cy="250" rx="150" ry="134" fill="${c.fur}" stroke="${c.dark}" stroke-width="6"/>
    <ellipse cx="318" cy="228" rx="46" ry="40" fill="${c.dark}" opacity="0.35"/>
    <ellipse cx="256" cy="306" rx="78" ry="56" fill="${c.light}"/>
    <ellipse cx="122" cy="238" rx="46" ry="94" transform="rotate(18 122 238)" fill="${c.dark}" stroke="${INK}" stroke-width="4" stroke-opacity="0.35"/>
    <ellipse cx="390" cy="238" rx="46" ry="94" transform="rotate(-18 390 238)" fill="${c.dark}" stroke="${INK}" stroke-width="4" stroke-opacity="0.35"/>
    <ellipse cx="256" cy="284" rx="26" ry="18" fill="${INK}"/>
    <ellipse cx="248" cy="278" rx="8" ry="5" fill="#fff" opacity="0.8"/>`;
}

function nameTag(name, level) {
  const label = escapeXml(`${name} · Nv.${level}`);
  return `<rect x="96" y="452" width="320" height="52" rx="26" fill="#FFFFFF" stroke="${INK}" stroke-width="6"/>
    <text x="256" y="488" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="27" fill="${INK}">${label}</text>`;
}

/** Em pelagem escura, os traços dos olhos ficam claros para aparecer. */
function eyesFor(palette, mood) {
  const svg = eyes(mood);
  if (palette.fur !== "#3B3B46") return svg;
  return svg
    .replaceAll(`stroke="${INK}"`, `stroke="#F4F4F8"`)
    .replaceAll(`fill="${INK}"/>`, `fill="${INK}" stroke="#F4F4F8" stroke-width="4"/>`);
}

/** Monta o SVG do pet. */
export function buildPetSvg({ species, color, mood = "feliz", level = 1, name }) {
  const palette = PET_COLORS[species]?.[color] || Object.values(PET_COLORS[species] || PET_COLORS.gato)[0];
  const body = species === "cachorro" ? dogBody(palette) : catBody(palette);
  const blush =
    mood === "triste" || mood === "sujo"
      ? ""
      : `<ellipse cx="160" cy="292" rx="24" ry="13" fill="#FF8FA3" opacity="0.55"/><ellipse cx="352" cy="292" rx="24" ry="13" fill="#FF8FA3" opacity="0.55"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <ellipse cx="256" cy="486" rx="160" ry="18" fill="#000" opacity="0.12"/>
    ${body}
    ${blush}
    ${eyesFor(palette, mood)}
    ${mouth(species, mood)}
    ${accessories(species, level)}
    ${extras(species, mood)}
    ${name ? nameTag(name, level) : ""}
  </svg>`;
}

const cache = new Map();
const CACHE_LIMIT = 200;

/** Renderiza o pet como WebP 512x512 (fundo transparente). */
export async function renderPetSticker(options) {
  const key = JSON.stringify([options.species, options.color, options.mood, options.level, options.name]);
  if (cache.has(key)) return cache.get(key);

  const buffer = await sharp(Buffer.from(buildPetSvg(options)))
    .resize(512, 512)
    .webp({ quality: 90 })
    .toBuffer();

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, buffer);
  return buffer;
}
