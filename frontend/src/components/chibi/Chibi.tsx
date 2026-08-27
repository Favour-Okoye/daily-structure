import type { CharId, Mood } from "../../lib/crew";

/**
 * Hand-drawn chibi crew — original art in the MoneyTree "drawn inline SVG" style.
 * One shared body, shared mood faces, per-character palette + props + level auras.
 * <svg key={char:mood:level}> remounts on change so the pop-in animation fires.
 */

type Prop = "strawHat" | "swords" | "earrings" | "scar" | "haramaki" | "staff"
  | "longNose" | "whiskers" | "lowerMask" | "antlerHat" | "book" | "curlyBrow";

interface ChibiConfig {
  skin: string;
  hair: string;
  hairStyle: "spiky" | "buzz" | "long";
  top: string;
  sleeves?: string;
  pants: string;
  shoes: string;
  headband?: string;
  props: Prop[];
  /** Aura colors per level, index = level-2 (level 2 gets aura[0], etc.) */
  aura?: string[];
}

const CONFIG: Record<CharId, ChibiConfig> = {
  luffy: {
    skin: "#fcd9b8", hair: "#1c1917", hairStyle: "spiky",
    top: "#dc2626", pants: "#1e40af", shoes: "#78350f",
    props: ["strawHat", "scar"], aura: ["#fda4af", "#f87171", "#dc2626"],
  },
  zoro: {
    skin: "#eec9a0", hair: "#16a34a", hairStyle: "buzz",
    top: "#e2e8f0", pants: "#1c1917", shoes: "#1c1917",
    props: ["haramaki", "swords", "earrings"], aura: ["#86efac", "#22c55e"],
  },
  nami: {
    skin: "#fcd9b8", hair: "#f97316", hairStyle: "long",
    top: "#ffffff", sleeves: "#fcd9b8", pants: "#3b82f6", shoes: "#b45309",
    props: ["staff"], aura: ["#bae6fd", "#38bdf8"],
  },
  usopp: {
    skin: "#d4a373", hair: "#44403c", hairStyle: "long",
    top: "#a16207", sleeves: "#d4a373", pants: "#4d7c0f", shoes: "#1c1917",
    props: ["longNose"], aura: ["#fde047", "#facc15"],
  },
  sanji: {
    skin: "#fcd9b8", hair: "#fbbf24", hairStyle: "buzz",
    top: "#0f172a", pants: "#0f172a", shoes: "#1c1917",
    props: ["curlyBrow"], aura: ["#fb923c", "#f97316"],
  },
  chopper: {
    skin: "#e8b98a", hair: "#92400e", hairStyle: "buzz",
    top: "#be185d", pants: "#831843", shoes: "#4c0519",
    props: ["antlerHat"], aura: ["#f9a8d4", "#ec4899"],
  },
  robin: {
    skin: "#f5d0a9", hair: "#1e1b4b", hairStyle: "long",
    top: "#6d28d9", sleeves: "#f5d0a9", pants: "#312e81", shoes: "#1c1917",
    props: ["book"], aura: ["#c4b5fd", "#8b5cf6"],
  },
  naruto: {
    skin: "#fcd9b8", hair: "#facc15", hairStyle: "spiky",
    top: "#f97316", pants: "#f97316", shoes: "#1e40af",
    headband: "#1e40af", props: ["whiskers"], aura: ["#fdba74", "#fb923c", "#fde047"],
  },
  sasuke: {
    skin: "#f5d0a9", hair: "#1e293b", hairStyle: "spiky",
    top: "#1e3a8a", pants: "#e7e5e4", shoes: "#1c1917",
    headband: "#1e293b", props: [], aura: ["#a5b4fc", "#6366f1"],
  },
  sakura: {
    skin: "#fcd9b8", hair: "#f9a8d4", hairStyle: "long",
    top: "#dc2626", sleeves: "#fcd9b8", pants: "#fdf2f8", shoes: "#7f1d1d",
    headband: "#dc2626", props: [], aura: ["#fbcfe8", "#f472b6"],
  },
  kakashi: {
    skin: "#f5d0a9", hair: "#cbd5e1", hairStyle: "spiky",
    top: "#334155", pants: "#334155", shoes: "#1c1917",
    headband: "#334155", props: ["lowerMask"], aura: ["#e0f2fe", "#7dd3fc"],
  },
  hinata: {
    skin: "#fcd9b8", hair: "#312e81", hairStyle: "long",
    top: "#c7d2fe", sleeves: "#c7d2fe", pants: "#312e81", shoes: "#1c1917",
    props: [], aura: ["#e0e7ff", "#a5b4fc"],
  },
};

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
      return (
        <g>
          <path d="M42 51 q6 -7 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M66 51 q6 -7 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 60 q10 13 20 0 z" fill="#7f1d1d" />
          <path d="M52 61 q8 6 16 0 l0 2 q-8 5 -16 0 z" fill="#fda4af" />
          <circle cx="40" cy="60" r="4.5" fill="#fda4af" opacity="0.6" />
          <circle cx="80" cy="60" r="4.5" fill="#fda4af" opacity="0.6" />
        </g>
      );
    case "neutral":
      return (
        <g>
          <circle cx="48" cy="51" r="3.4" fill="#1c1917" />
          <circle cx="72" cy="51" r="3.4" fill="#1c1917" />
          <path d="M54 64 h12" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "worried":
      return (
        <g>
          <path d="M41 44 l12 4" stroke="#1c1917" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M79 44 l-12 4" stroke="#1c1917" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="48" cy="53" r="3.2" fill="#1c1917" />
          <circle cx="72" cy="53" r="3.2" fill="#1c1917" />
          <path d="M52 65 q4 -4 8 0 q4 4 8 0" fill="none" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M87 40 q4 6 0 9 q-4 -3 0 -9" fill="#38bdf8" />
        </g>
      );
    case "sad":
    case "packing":
      return (
        <g>
          <path d="M42 53 q6 6 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M66 53 q6 6 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M46 58 q3 7 -1 10 q-4 -3 1 -10" fill="#38bdf8" />
          <path d="M52 69 q8 -8 16 0" fill="none" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    default:
      return <Face mood="neutral" />;
  }
}

function Hair({ style, color }: { style: ChibiConfig["hairStyle"]; color: string }) {
  switch (style) {
    case "spiky":
      return (
        <path
          d="M31 46 q-2 -18 10 -25 l4 7 6 -9 5 8 5 -9 5 9 6 -8 4 9 6 -6 q9 8 7 24 q-14 -10 -29 -10 q-15 0 -29 10 z"
          fill={color}
        />
      );
    case "buzz":
      return <path d="M31 44 a29 27 0 0 1 58 0 q-14 -12 -29 -12 q-15 0 -29 12 z" fill={color} />;
    case "long":
      return (
        <g>
          <path d="M30 46 q-4 30 4 42 l10 -6 q-6 -16 -2 -30 z" fill={color} />
          <path d="M90 46 q4 30 -4 42 l-10 -6 q6 -16 2 -30 z" fill={color} />
          <path d="M31 46 a29 27 0 0 1 58 0 q-6 -8 -14 -9 l-2 6 -6 -8 -8 8 -6 -7 -4 7 q-12 0 -18 3 z" fill={color} />
        </g>
      );
  }
}

function Props({ config }: { config: ChibiConfig }) {
  const has = (p: Prop) => config.props.includes(p);
  return (
    <g>
      {config.headband && (
        <g>
          <rect x="33" y="30" width="54" height="8" rx="4" fill={config.headband} />
          <rect x="52" y="29" width="16" height="10" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <path d="M56 34 q4 -4 8 0" fill="none" stroke="#475569" strokeWidth="1.4" />
        </g>
      )}
      {has("haramaki") && <rect x="44" y="93" width="32" height="9" rx="4" fill="#15803d" />}
      {has("swords") && (
        <g transform="translate(30 96) rotate(62)">
          <rect x="0" y="0" width="30" height="4.5" rx="2" fill="#0f172a" />
          <rect x="0" y="6" width="30" height="4.5" rx="2" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
          <rect x="0" y="12" width="30" height="4.5" rx="2" fill="#7f1d1d" />
          <circle cx="1" cy="2.2" r="2.6" fill="#fbbf24" />
          <circle cx="1" cy="8.2" r="2.6" fill="#fbbf24" />
          <circle cx="1" cy="14.2" r="2.6" fill="#fbbf24" />
        </g>
      )}
      {has("earrings") && (
        <g fill="#fbbf24">
          <circle cx="88" cy="58" r="1.8" />
          <circle cx="88" cy="62" r="1.8" />
          <circle cx="88" cy="66" r="1.8" />
        </g>
      )}
      {has("scar") && (
        <path d="M44 59 l7 0 M46 57 l0 4" stroke="#b45309" strokeWidth="1.4" strokeLinecap="round" />
      )}
      {has("whiskers") && (
        <g stroke="#78350f" strokeWidth="1.6" strokeLinecap="round">
          <path d="M36 54 l8 1 M36 58 l8 0 M36 62 l8 -1" />
          <path d="M84 54 l-8 1 M84 58 l-8 0 M84 62 l-8 -1" />
        </g>
      )}
      {has("lowerMask") && (
        <path d="M36 56 q24 22 48 0 l0 14 q-24 14 -48 0 z" fill="#1e293b" />
      )}
      {has("longNose") && (
        <path d="M60 55 l0 3 22 3 -22 3 z" fill="#b45309" stroke="#92400e" strokeWidth="1" />
      )}
      {has("curlyBrow") && (
        <path d="M64 44 q8 -4 12 2 q-5 -1 -7 2" fill="none" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
      )}
      {has("antlerHat") && (
        <g>
          <path d="M34 36 a27 20 0 0 1 52 0 l0 6 -52 0 z" fill="#be185d" />
          <rect x="34" y="38" width="52" height="6" fill="#f8fafc" />
          <g stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M36 30 q-8 -8 -6 -18 M36 30 q-10 0 -14 -6" />
            <path d="M84 30 q8 -8 6 -18 M84 30 q10 0 14 -6" />
          </g>
          <circle cx="60" cy="58" r="4" fill="#3b82f6" />
        </g>
      )}
      {has("book") && (
        <g transform="translate(78 96)">
          <rect x="0" y="0" width="16" height="12" rx="2" fill="#7c3aed" stroke="#4c1d95" strokeWidth="1.4" />
          <line x1="8" y1="1" x2="8" y2="11" stroke="#ede9fe" strokeWidth="1.4" />
        </g>
      )}
      {has("staff") && (
        <g>
          <rect x="86" y="66" width="4" height="54" rx="2" fill="#1d4ed8" />
          <circle cx="88" cy="63" r="5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="2" />
        </g>
      )}
      {has("strawHat") && (
        <g transform="rotate(-4 60 26)">
          <ellipse cx="60" cy="28" rx="33" ry="8.5" fill="#fbbf24" stroke="#92400e" strokeWidth="2.5" />
          <path d="M38 27 a22 20 0 0 1 44 0 l0 2 a22 7 0 0 1 -44 0 z" fill="#fcd34d" stroke="#92400e" strokeWidth="2.5" />
          <path d="M38 23 a22 6 0 0 0 44 0 l0 6 a22 6 0 0 1 -44 0 z" fill="#dc2626" />
        </g>
      )}
    </g>
  );
}

function Bindle() {
  return (
    <g>
      <line x1="80" y1="92" x2="102" y2="70" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="104" cy="70" r="8" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
      <circle cx="101" cy="67" r="1.6" fill="#fde68a" />
      <circle cx="107" cy="71" r="1.6" fill="#fde68a" />
      <rect x="30" y="118" width="18" height="13" rx="3" fill="#92400e" stroke="#78350f" strokeWidth="1.5" />
      <rect x="30" y="123" width="18" height="3" fill="#fbbf24" />
    </g>
  );
}

export function Chibi({
  char,
  mood,
  level = 1,
  size = 110,
}: {
  char: CharId;
  mood: Mood;
  level?: number;
  size?: number;
}) {
  const config = CONFIG[char];
  const slump = mood === "sad" || mood === "packing";
  const auraColor = level >= 2 ? config.aura?.[Math.min(level - 2, (config.aura?.length ?? 1) - 1)] : undefined;

  if (mood === "gone") {
    return (
      <svg key={`${char}:gone`} viewBox="0 0 120 140" width={size} height={(size * 140) / 120} className="pop-in" role="img" aria-label={`${char} is gone`}>
        <circle cx="60" cy="48" r="30" fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeDasharray="6 5" />
        <rect x="42" y="80" width="36" height="32" rx="10" fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeDasharray="6 5" />
        <text x="60" y="56" textAnchor="middle" fontSize="20" fill="#a8a29e">?</text>
      </svg>
    );
  }

  return (
    <svg
      key={`${char}:${mood}:${level}`}
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className="pop-in"
      role="img"
      aria-label={`${char}, ${mood}`}
    >
      {auraColor && (
        <g>
          <ellipse cx="60" cy="78" rx="46" ry="56" fill={auraColor} opacity="0.28" />
          {level >= 3 && (
            <g fill={auraColor}>
              <circle className="twinkle" cx="18" cy="40" r="3.2" />
              <circle className="twinkle" cx="102" cy="34" r="2.6" />
              <circle className="twinkle" cx="104" cy="96" r="3" />
              <circle className="twinkle" cx="14" cy="100" r="2.4" />
            </g>
          )}
        </g>
      )}
      <g
        className="idle-bob"
        style={slump ? { filter: "saturate(0.55)", transform: "translateY(4px)" } : undefined}
      >
        {/* legs */}
        <rect x="47" y="108" width="11" height="22" rx="5" fill={config.pants} />
        <rect x="62" y="108" width="11" height="22" rx="5" fill={config.pants} />
        <ellipse cx="52" cy="132" rx="8" ry="4.5" fill={config.shoes} />
        <ellipse cx="68" cy="132" rx="8" ry="4.5" fill={config.shoes} />
        {/* arms */}
        <rect x="33" y="84" width="11" height="24" rx="5.5" fill={config.sleeves ?? config.top} />
        <rect x="76" y="84" width="11" height="24" rx="5.5" fill={config.sleeves ?? config.top} />
        {/* torso */}
        <rect x="42" y="80" width="36" height="32" rx="10" fill={config.top} stroke="#00000022" strokeWidth="1.5" />
        {/* head */}
        <circle cx="60" cy="48" r="30" fill={config.skin} />
        <Hair style={config.hairStyle} color={config.hair} />
        <Face mood={mood} />
        <Props config={config} />
        {mood === "packing" && <Bindle />}
      </g>
    </svg>
  );
}
