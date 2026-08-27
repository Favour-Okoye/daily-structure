import type { CharId, Mood } from "../../lib/crew";

/**
 * Hand-drawn chibi crew — kawaii proportions: huge head, tiny body,
 * big sparkly eyes, permanent blush. Original art, inspired-by only.
 * <svg key={char:mood:level}> remounts on change so the pop-in fires.
 */

type Prop = "strawHat" | "swords" | "earrings" | "scar" | "haramaki" | "staff"
  | "longNose" | "whiskers" | "lowerMask" | "antlerHat" | "book" | "curlyBrow"
  | "bandana" | "vest" | "sailorTop";

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
  /** Aura colors per level, index = level-2. */
  aura?: string[];
}

const CONFIG: Record<CharId, ChibiConfig> = {
  luffy: {
    skin: "#fde3c5", hair: "#1c1917", hairStyle: "spiky",
    top: "#ef4444", pants: "#3b82f6", shoes: "#92400e",
    props: ["strawHat", "scar", "vest"], aura: ["#fda4af", "#f87171", "#dc2626"],
  },
  zoro: {
    skin: "#f5d3a5", hair: "#22c55e", hairStyle: "buzz",
    top: "#f1f5f9", pants: "#14532d", shoes: "#1c1917",
    props: ["bandana", "haramaki", "swords", "earrings"], aura: ["#86efac", "#22c55e"],
  },
  nami: {
    skin: "#fde3c5", hair: "#fb923c", hairStyle: "long",
    top: "#ffffff", sleeves: "#fde3c5", pants: "#60a5fa", shoes: "#b45309",
    props: ["staff", "sailorTop"], aura: ["#bae6fd", "#38bdf8"],
  },
  usopp: {
    skin: "#deab7c", hair: "#44403c", hairStyle: "long",
    top: "#ca8a04", sleeves: "#deab7c", pants: "#4d7c0f", shoes: "#1c1917",
    props: ["longNose"], aura: ["#fde047", "#facc15"],
  },
  sanji: {
    skin: "#fde3c5", hair: "#fcd34d", hairStyle: "buzz",
    top: "#1e293b", pants: "#1e293b", shoes: "#1c1917",
    props: ["curlyBrow"], aura: ["#fb923c", "#f97316"],
  },
  chopper: {
    skin: "#f2c299", hair: "#92400e", hairStyle: "buzz",
    top: "#ec4899", pants: "#9d174d", shoes: "#4c0519",
    props: ["antlerHat"], aura: ["#f9a8d4", "#ec4899"],
  },
  robin: {
    skin: "#fbd8b0", hair: "#312e81", hairStyle: "long",
    top: "#8b5cf6", sleeves: "#fbd8b0", pants: "#4c1d95", shoes: "#1c1917",
    props: ["book"], aura: ["#c4b5fd", "#8b5cf6"],
  },
  naruto: {
    skin: "#fde3c5", hair: "#fde047", hairStyle: "spiky",
    top: "#fb923c", pants: "#fb923c", shoes: "#1e40af",
    headband: "#3b82f6", props: ["whiskers"], aura: ["#fdba74", "#fb923c", "#fde047"],
  },
  sasuke: {
    skin: "#fbd8b0", hair: "#334155", hairStyle: "spiky",
    top: "#1e3a8a", pants: "#e7e5e4", shoes: "#1c1917",
    headband: "#475569", props: [], aura: ["#a5b4fc", "#6366f1"],
  },
  sakura: {
    skin: "#fde3c5", hair: "#fbcfe8", hairStyle: "long",
    top: "#ef4444", sleeves: "#fde3c5", pants: "#fdf2f8", shoes: "#7f1d1d",
    headband: "#ef4444", props: [], aura: ["#fbcfe8", "#f472b6"],
  },
  kakashi: {
    skin: "#fbd8b0", hair: "#e2e8f0", hairStyle: "spiky",
    top: "#475569", pants: "#475569", shoes: "#1c1917",
    headband: "#334155", props: ["lowerMask"], aura: ["#e0f2fe", "#7dd3fc"],
  },
  hinata: {
    skin: "#fde3c5", hair: "#3730a3", hairStyle: "long",
    top: "#c7d2fe", sleeves: "#c7d2fe", pants: "#312e81", shoes: "#1c1917",
    props: [], aura: ["#e0e7ff", "#a5b4fc"],
  },
};

/** Big warm brown anime eye — dark rim, amber iris, deep pupil, double glints. */
function Eye({ cx }: { cx: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={62} rx={6.8} ry={8.4} fill="#2b1708" />
      <ellipse cx={cx} cy={63.5} rx={4.8} ry={5.8} fill="#92400e" />
      <ellipse cx={cx} cy={65.5} rx={2.7} ry={3.1} fill="#2b1708" />
      <circle cx={cx + 2.3} cy={58.4} r={2.7} fill="#ffffff" />
      <circle cx={cx - 2.7} cy={66} r={1.3} fill="#ffffff" opacity="0.95" />
    </g>
  );
}

function Blush() {
  return (
    <g fill="#fda4af" opacity="0.55">
      <ellipse cx={34} cy={73} rx={5.5} ry={3.2} />
      <ellipse cx={86} cy={73} rx={5.5} ry={3.2} />
    </g>
  );
}

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
      return (
        <g>
          <path d="M38 61 q7 -9 14 0" fill="none" stroke="#292524" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M68 61 q7 -9 14 0" fill="none" stroke="#292524" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M51 71 q9 11 18 0 z" fill="#9f1239" />
          <path d="M53 72 q7 5 14 0 l0 1.6 q-7 4.5 -14 0 z" fill="#fda4af" />
          <Blush />
        </g>
      );
    case "neutral":
      return (
        <g>
          <Eye cx={45} />
          <Eye cx={75} />
          {/* the ω cat-mouth — peak kawaii */}
          <path d="M53 72.5 q3.5 4 7 0 q3.5 4 7 0" fill="none" stroke="#292524" strokeWidth="2.6" strokeLinecap="round" />
          <Blush />
        </g>
      );
    case "worried":
      return (
        <g>
          <path d="M35 49 l15 4.5" stroke="#292524" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M85 49 l-15 4.5" stroke="#292524" strokeWidth="2.8" strokeLinecap="round" />
          <Eye cx={45} />
          <Eye cx={75} />
          <path d="M52 74 q4 -4 8 0 q4 4 8 0" fill="none" stroke="#292524" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M94 46 q4.5 7 0 10.5 q-4.5 -3.5 0 -10.5" fill="#38bdf8" />
          <Blush />
        </g>
      );
    case "sad":
    case "packing":
      return (
        <g>
          <path d="M38 63 q7 8 14 0" fill="none" stroke="#292524" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M68 63 q7 8 14 0" fill="none" stroke="#292524" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M44 68 q3.5 8 -1 11.5 q-4.5 -3.5 1 -11.5" fill="#38bdf8" />
          <path d="M52 77 q8 -7 16 0" fill="none" stroke="#292524" strokeWidth="2.8" strokeLinecap="round" />
          <Blush />
        </g>
      );
    default:
      return <Face mood="neutral" />;
  }
}

function Hair({ style, color }: { style: ChibiConfig["hairStyle"]; color: string }) {
  switch (style) {
    case "spiky":
      // chunky pointed bangs hanging over the forehead — ref-board style
      return (
        <path
          d="M22 52 a38 34 0 0 1 76 0 l-8 -8 -6 12 -8 -14 -8 14 -8 -14 -8 14 -8 -14 -6 12 -8 -8 z"
          fill={color}
        />
      );
    case "buzz":
      return <path d="M22 55 a38 36 0 0 1 76 0 q-19 -17 -38 -17 q-19 0 -38 17 z" fill={color} />;
    case "long":
      // side curtains + a soft pointed fringe
      return (
        <g>
          <path d="M21 54 q-6 34 4 50 l12 -7 q-7 -18 -3 -35 z" fill={color} />
          <path d="M99 54 q6 34 -4 50 l-12 -7 q7 -18 3 -35 z" fill={color} />
          <path
            d="M22 55 a38 36 0 0 1 76 0 l-6 -6 -7 12 -8 -12 -9 13 -9 -13 -8 12 -7 -12 -6 6 z"
            fill={color}
          />
        </g>
      );
  }
}

function Props({ config }: { config: ChibiConfig }) {
  const has = (p: Prop) => config.props.includes(p);
  return (
    <g>
      {has("bandana") && (
        <g>
          <path d="M23 48 a38 32 0 0 1 74 0 l0 5 q-37 -13 -74 0 z" fill="#1c1917" />
          <path d="M93 42 l12 -7 -3 11 9 -1 -9 9 z" fill="#1c1917" />
        </g>
      )}
      {has("vest") && (
        <g>
          <rect x={54} y={93} width={12} height={24} rx={3} fill={config.skin} />
          <circle cx={51} cy={100} r={1.7} fill="#fbbf24" />
          <circle cx={51} cy={107} r={1.7} fill="#fbbf24" />
          <circle cx={69} cy={100} r={1.7} fill="#fbbf24" />
          <rect x={47} y={109} width={11} height={4} rx={2} fill="#ffffff" />
          <rect x={62} y={109} width={11} height={4} rx={2} fill="#ffffff" />
        </g>
      )}
      {has("sailorTop") && (
        <g>
          <path d="M46 93 l14 11 14 -11" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
          <rect x={45} y={107} width={30} height={4.5} rx={2} fill="#3b82f6" opacity="0.9" />
        </g>
      )}
      {config.headband && (
        <g>
          <rect x={24} y={33} width={72} height={9} rx={4.5} fill={config.headband} />
          <rect x={50} y={31.5} width={20} height={12} rx={2.5} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <path d="M55 38 q5 -4.5 10 0" fill="none" stroke="#475569" strokeWidth="1.5" />
        </g>
      )}
      {has("haramaki") && <rect x={45} y={100} width={30} height={8} rx={4} fill="#15803d" />}
      {has("swords") && (
        <g transform="translate(35 101) rotate(64)">
          <rect x={0} y={0} width={24} height={4} rx={2} fill="#0f172a" />
          <rect x={0} y={5.5} width={24} height={4} rx={2} fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
          <rect x={0} y={11} width={24} height={4} rx={2} fill="#7f1d1d" />
          <circle cx={1} cy={2} r={2.4} fill="#fbbf24" />
          <circle cx={1} cy={7.5} r={2.4} fill="#fbbf24" />
          <circle cx={1} cy={13} r={2.4} fill="#fbbf24" />
        </g>
      )}
      {has("earrings") && (
        <g fill="#fbbf24">
          <circle cx={95} cy={66} r={1.8} />
          <circle cx={95} cy={70.5} r={1.8} />
          <circle cx={95} cy={75} r={1.8} />
        </g>
      )}
      {has("scar") && (
        <path d="M36 68 h7 M38.5 66 v4" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" />
      )}
      {has("whiskers") && (
        <g stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
          <path d="M26 62 l9 1 M26 66.5 l9 0 M26 71 l9 -1" />
          <path d="M94 62 l-9 1 M94 66.5 l-9 0 M94 71 l-9 -1" />
        </g>
      )}
      {has("lowerMask") && (
        <path d="M25 66 q35 26 70 0 l0 15 q-35 17 -70 0 z" fill="#1e293b" />
      )}
      {has("longNose") && (
        <path d="M60 64 l0 3.5 24 3 -24 3 z" fill="#c2762b" stroke="#92400e" strokeWidth="1" />
      )}
      {has("curlyBrow") && (
        <path d="M66 47 q9 -4.5 13.5 2 q-5.5 -1 -8 2.5" fill="none" stroke="#92400e" strokeWidth="2.4" strokeLinecap="round" />
      )}
      {has("antlerHat") && (
        <g>
          <path d="M24 38 a37 27 0 0 1 72 0 l0 7 -72 0 z" fill="#ec4899" />
          <rect x={24} y={40} width={72} height={7} fill="#f8fafc" />
          <g stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" fill="none">
            <path d="M27 30 q-9 -9 -7 -20 M27 30 q-11 0 -16 -7" />
            <path d="M93 30 q9 -9 7 -20 M93 30 q11 0 16 -7" />
          </g>
          <ellipse cx={60} cy={67} rx={4.5} ry={4} fill="#3b82f6" />
          <circle cx={58.5} cy={65.5} r={1.3} fill="#93c5fd" />
        </g>
      )}
      {has("book") && (
        <g transform="translate(80 100)">
          <rect x={0} y={0} width={15} height={11} rx={2} fill="#7c3aed" stroke="#4c1d95" strokeWidth="1.4" />
          <line x1={7.5} y1={1} x2={7.5} y2={10} stroke="#ede9fe" strokeWidth="1.4" />
        </g>
      )}
      {has("staff") && (
        <g>
          <rect x={90} y={72} width={4} height={50} rx={2} fill="#1d4ed8" />
          <circle cx={92} cy={68} r={5} fill="#93c5fd" stroke="#1d4ed8" strokeWidth="2" />
        </g>
      )}
      {has("strawHat") && (
        <g transform="rotate(-3 60 22)">
          <ellipse cx={60} cy={27} rx={46} ry={11.5} fill="#f59e0b" stroke="#92400e" strokeWidth="2.5" />
          <ellipse cx={60} cy={25.5} rx={41} ry={9.5} fill="#fbbf24" />
          <path d="M30 24 a30 25 0 0 1 60 0 l0 3 a30 9 0 0 1 -60 0 z" fill="#fcd34d" stroke="#92400e" strokeWidth="2.5" />
          <path d="M30 19 a30 8 0 0 0 60 0 l0 8 a30 8 0 0 1 -60 0 z" fill="#ef4444" />
          <path d="M38 12 a30 18 0 0 1 44 0" fill="none" stroke="#d97706" strokeWidth="1.6" opacity="0.7" />
        </g>
      )}
    </g>
  );
}

function Bindle() {
  return (
    <g>
      <line x1={82} y1={98} x2={104} y2={76} stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={106} cy={74} r={7.5} fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
      <circle cx={103} cy={71} r={1.5} fill="#fde68a" />
      <circle cx={109} cy={75} r={1.5} fill="#fde68a" />
      <rect x={16} y={118} width={17} height={12} rx={3} fill="#92400e" stroke="#78350f" strokeWidth="1.5" />
      <rect x={16} y={122.5} width={17} height={3} fill="#fbbf24" />
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
  const auraColor =
    level >= 2 ? config.aura?.[Math.min(level - 2, (config.aura?.length ?? 1) - 1)] : undefined;

  if (mood === "gone") {
    return (
      <svg key={`${char}:gone`} viewBox="0 0 120 140" width={size} height={(size * 140) / 120} className="pop-in" role="img" aria-label={`${char} is gone`}>
        <circle cx={60} cy={56} r={38} fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeDasharray="7 5" />
        <rect x={46} y={96} width={28} height={26} rx={12} fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeDasharray="7 5" />
        <text x={60} y={66} textAnchor="middle" fontSize="24" fill="#a8a29e">?</text>
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
          <ellipse cx={60} cy={74} rx={50} ry={60} fill={auraColor} opacity="0.28" />
          {level >= 3 && (
            <g fill={auraColor}>
              <circle className="twinkle" cx={14} cy={38} r={3.2} />
              <circle className="twinkle" cx={106} cy={30} r={2.6} />
              <circle className="twinkle" cx={108} cy={100} r={3} />
              <circle className="twinkle" cx={12} cy={104} r={2.4} />
            </g>
          )}
        </g>
      )}
      <g
        className="idle-bob"
        style={slump ? { filter: "saturate(0.6)", transform: "translateY(4px)" } : undefined}
      >
        {/* tiny legs */}
        <rect x={48} y={112} width={10} height={13} rx={5} fill={config.pants} />
        <rect x={62} y={112} width={10} height={13} rx={5} fill={config.pants} />
        <ellipse cx={53} cy={127} rx={7} ry={4} fill={config.shoes} />
        <ellipse cx={67} cy={127} rx={7} ry={4} fill={config.shoes} />
        {/* tiny arms */}
        <rect x={37} y={96} width={9} height={17} rx={4.5} fill={config.sleeves ?? config.top} />
        <rect x={74} y={96} width={9} height={17} rx={4.5} fill={config.sleeves ?? config.top} />
        {/* tiny torso */}
        <rect x={45} y={92} width={30} height={26} rx={12} fill={config.top} stroke="#00000022" strokeWidth="1.5" />
        {/* HUGE head — the kawaii law */}
        <circle cx={60} cy={56} r={38} fill={config.skin} />
        <Hair style={config.hairStyle} color={config.hair} />
        <Face mood={mood} />
        <Props config={config} />
        {mood === "packing" && <Bindle />}
      </g>
    </svg>
  );
}
