import type { CharId, Mood } from "../../lib/crew";

/**
 * Hand-drawn chibi crew — original art in the MoneyTree "drawn inline SVG" style.
 * One shared body, five shared mood faces, per-character palette + props.
 * <svg key={char:mood}> remounts on change so the pop-in animation fires.
 */

interface ChibiConfig {
  skin: string;
  hair: string;
  hairStyle: "spiky" | "buzz" | "long";
  top: string;
  sleeves?: string;
  pants: string;
  shoes: string;
  props: ("strawHat" | "swords" | "earrings" | "scar" | "haramaki" | "staff")[];
}

const CONFIG: Partial<Record<CharId, ChibiConfig>> = {
  luffy: {
    skin: "#fcd9b8",
    hair: "#1c1917",
    hairStyle: "spiky",
    top: "#dc2626",
    pants: "#1e40af",
    shoes: "#78350f",
    props: ["strawHat", "scar"],
  },
  zoro: {
    skin: "#eec9a0",
    hair: "#16a34a",
    hairStyle: "buzz",
    top: "#e2e8f0",
    pants: "#1c1917",
    shoes: "#1c1917",
    props: ["haramaki", "swords", "earrings"],
  },
  nami: {
    skin: "#fcd9b8",
    hair: "#f97316",
    hairStyle: "long",
    top: "#ffffff",
    sleeves: "#fcd9b8",
    pants: "#3b82f6",
    shoes: "#b45309",
    props: ["staff"],
  },
};

function Face({ mood, skin }: { mood: Mood; skin: string }) {
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
      return (
        <g>
          <path d="M42 53 q6 6 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M66 53 q6 6 12 0" fill="none" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <path d="M46 58 q3 7 -1 10 q-4 -3 1 -10" fill="#38bdf8" />
          <path d="M52 69 q8 -8 16 0" fill="none" stroke="#1c1917" strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    default:
      return <Face mood="neutral" skin={skin} />;
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
  return (
    <g>
      {config.props.includes("haramaki") && (
        <rect x="44" y="93" width="32" height="9" rx="4" fill="#15803d" />
      )}
      {config.props.includes("swords") && (
        <g transform="translate(30 96) rotate(62)">
          <rect x="0" y="0" width="30" height="4.5" rx="2" fill="#0f172a" />
          <rect x="0" y="6" width="30" height="4.5" rx="2" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
          <rect x="0" y="12" width="30" height="4.5" rx="2" fill="#7f1d1d" />
          <circle cx="1" cy="2.2" r="2.6" fill="#fbbf24" />
          <circle cx="1" cy="8.2" r="2.6" fill="#fbbf24" />
          <circle cx="1" cy="14.2" r="2.6" fill="#fbbf24" />
        </g>
      )}
      {config.props.includes("earrings") && (
        <g fill="#fbbf24">
          <circle cx="88" cy="58" r="1.8" />
          <circle cx="88" cy="62" r="1.8" />
          <circle cx="88" cy="66" r="1.8" />
        </g>
      )}
      {config.props.includes("scar") && (
        <path d="M44 59 l7 0 M46 57 l0 4" stroke="#b45309" strokeWidth="1.4" strokeLinecap="round" />
      )}
      {config.props.includes("staff") && (
        <g>
          <rect x="86" y="66" width="4" height="54" rx="2" fill="#1d4ed8" />
          <circle cx="88" cy="63" r="5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="2" />
        </g>
      )}
      {config.props.includes("strawHat") && (
        <g transform="rotate(-4 60 26)">
          <ellipse cx="60" cy="28" rx="33" ry="8.5" fill="#fbbf24" stroke="#92400e" strokeWidth="2.5" />
          <path d="M38 27 a22 20 0 0 1 44 0 l0 2 a22 7 0 0 1 -44 0 z" fill="#fcd34d" stroke="#92400e" strokeWidth="2.5" />
          <path d="M38 23 a22 6 0 0 0 44 0 l0 6 a22 6 0 0 1 -44 0 z" fill="#dc2626" />
        </g>
      )}
    </g>
  );
}

export function Chibi({ char, mood, size = 110 }: { char: CharId; mood: Mood; size?: number }) {
  const config = CONFIG[char];
  if (!config) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-stone-100 text-3xl"
        style={{ width: size, height: size }}
      >
        ❓
      </div>
    );
  }
  const slump = mood === "sad";
  return (
    <svg
      key={`${char}:${mood}`}
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className="pop-in"
      role="img"
      aria-label={`${char}, ${mood}`}
    >
      <g
        className="idle-bob"
        style={
          slump
            ? { filter: "saturate(0.55)", transform: "translateY(4px)" }
            : undefined
        }
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
        <Face mood={mood} skin={config.skin} />
        <Props config={config} />
      </g>
    </svg>
  );
}
