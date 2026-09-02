import { useMemo } from "react";
import { Chibi } from "./chibi/Chibi";
import { wallMinutes } from "../lib/day";
import {
  furnitureById,
  HOME_THEMES,
  isComfy,
  STORM_SAFE_FURNITURE,
  type CharId,
  type CrewState,
} from "../lib/crew";
import type { CrewMember } from "../lib/crewQueries";

/**
 * The Living Village — a drawn panorama where everything you buy is VISIBLE.
 * Sky follows the real clock; houses grow from tent → hut → dream home;
 * furniture hangs on the walls; comfy homes smoke their chimneys.
 */

const SKY: Record<string, { top: string; bottom: string; sun: boolean; stars: boolean }> = {
  dawn: { top: "#fcd9a8", bottom: "#fde9c9", sun: true, stars: false },
  day: { top: "#a5d5f2", bottom: "#d8ecf8", sun: true, stars: false },
  dusk: { top: "#e7a27b", bottom: "#f3cfa5", sun: true, stars: false },
  night: { top: "#141d3d", bottom: "#2a3560", sun: false, stars: true },
};

function skyFor(min: number) {
  if (min >= 5 * 60 && min < 8 * 60) return SKY.dawn;
  if (min >= 8 * 60 && min < 18 * 60) return SKY.day;
  if (min >= 18 * 60 && min < 21 * 60) return SKY.dusk;
  return SKY.night;
}

function House({
  charId,
  state,
  damaged,
  night,
}: {
  charId: CharId;
  state: CrewState;
  damaged: boolean;
  night: boolean;
}) {
  const home = state.village[charId];
  const theme = HOME_THEMES[charId];
  const comfy = isComfy(home);

  if (!home.built) {
    // a tent and a dream
    return (
      <svg viewBox="0 0 120 90" width={110} height={82} aria-label="tent">
        <polygon points="60,18 20,78 100,78" fill="#d6bb8f" stroke="#a98756" strokeWidth="3" />
        <polygon points="60,18 48,78 72,78" fill="#bfa072" />
        <rect x={8} y={54} width={4} height={26} fill="#8a6b42" />
        <rect x={0} y={44} width={22} height={14} rx={3} fill="#f5ead2" stroke="#a98756" strokeWidth="2" />
        <text x={11} y={54} textAnchor="middle" fontSize="9" fill="#8a6b42">🏠?</text>
      </svg>
    );
  }

  const wall = home.themed ? "#f3e3c3" : "#e8d6b0";
  const roof = home.themed ? "#c2543f" : "#a98756";

  return (
    <div className="relative">
      <svg viewBox="0 0 120 100" width={110} height={92} aria-label={`${charId}'s home`}>
        {/* smoke for comfy homes */}
        {comfy && (
          <g className="smoke" fill="#cbd5e1" opacity="0.8">
            <circle cx={92} cy={16} r={4} />
            <circle cx={97} cy={8} r={3} />
          </g>
        )}
        {comfy && <rect x={86} y={18} width={10} height={16} fill="#8a6b42" />}
        {/* roof */}
        <polygon points="60,6 8,44 112,44" fill={roof} stroke="#7c5b34" strokeWidth="3" />
        {/* walls */}
        <rect x={18} y={44} width={84} height={48} fill={wall} stroke="#7c5b34" strokeWidth="3" />
        {/* door */}
        <rect x={52} y={62} width={18} height={30} rx={3} fill="#8a6b42" />
        {/* window with night glow */}
        <rect x={28} y={56} width={16} height={14} rx={2} fill={night ? "#ffe9a8" : "#bfe3f2"} stroke="#7c5b34" strokeWidth="2" />
        {home.themed && (
          <text x={60} y={34} textAnchor="middle" fontSize="15">{theme.emoji}</text>
        )}
        {damaged && (
          <g>
            <path d="M30 44 l10 14 -8 2 12 16" fill="none" stroke="#44403c" strokeWidth="3" strokeLinecap="round" />
            <text x={98} y={60} fontSize="14">⚠️</text>
          </g>
        )}
      </svg>
      {/* furniture, visibly ON the house */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-wrap justify-center gap-0.5 px-2">
        {home.furniture.slice(0, 6).map((f, i) => (
          <span key={`${f}-${i}`} className="text-sm drop-shadow" title={furnitureById(f)?.title}>
            {furnitureById(f)?.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

function Ship() {
  return (
    <svg viewBox="0 0 170 150" width={150} height={132} className="idle-bob" aria-label="the crew's ship">
      <path d="M15 96 q70 26 140 0 l-12 34 q-58 16 -116 0 z" fill="#8a5a33" stroke="#5f3d20" strokeWidth="3" />
      <path d="M15 96 q70 26 140 0 l-4 10 q-66 22 -132 0 z" fill="#a06c3e" />
      <rect x={80} y={10} width={5} height={88} fill="#5f3d20" />
      <path d="M85 16 q44 18 0 52 z" fill="#f7f0dc" stroke="#c9b98e" strokeWidth="2" />
      <path d="M80 22 q-34 14 0 40 z" fill="#f7f0dc" stroke="#c9b98e" strokeWidth="2" />
      <path d="M85 10 l26 7 -26 7 z" fill="#dc2626" />
      <circle cx={42} cy={108} r={6} fill="#f6d7a0" stroke="#5f3d20" strokeWidth="2" />
      <circle cx={128} cy={108} r={6} fill="#f6d7a0" stroke="#5f3d20" strokeWidth="2" />
    </svg>
  );
}

export function VillageScene({
  aboard,
  state,
  onPick,
}: {
  aboard: CrewMember[];
  state: CrewState;
  onPick: (id: CharId) => void;
}) {
  const nowMin = wallMinutes();
  const sky = skyFor(nowMin);
  const night = sky === SKY.night;
  const stars = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        top: `${(i * 23) % 55}%`,
        size: 1.5 + ((i * 7) % 3),
      })),
    []
  );

  return (
    <div className="overflow-hidden rounded-3xl shadow-md ring-1 ring-sky-100">
      <div className="overflow-x-auto">
        <div
          className="relative"
          style={{
            minWidth: `${170 + aboard.length * 140}px`,
            height: "250px",
            background: `linear-gradient(${sky.top}, ${sky.bottom} 62%, #e9d9ae 62%, #dfca94 100%)`,
          }}
        >
          {/* celestial */}
          {sky.sun ? (
            <div
              className="absolute rounded-full"
              style={{ right: "6%", top: "8%", width: 44, height: 44, background: "radial-gradient(circle,#ffe9a8,#f6c14e)" }}
            />
          ) : (
            <div
              className="absolute rounded-full"
              style={{ right: "8%", top: "8%", width: 36, height: 36, background: "radial-gradient(circle,#f3f4f6,#cbd5e1)" }}
            />
          )}
          {sky.stars &&
            stars.map((s, i) => (
              <div
                key={i}
                className="twinkle absolute rounded-full bg-white"
                style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
              />
            ))}

          {/* sea + ship */}
          <div
            className="absolute bottom-0 left-0 h-[46%] w-[190px]"
            style={{ background: night ? "#1d2a52" : "#7cc0e8", borderTopRightRadius: "40px" }}
          />
          <div className="absolute bottom-[24%] left-2"><Ship /></div>

          {/* plots */}
          <div className="absolute bottom-0 left-[185px] flex items-end">
            {aboard.map((m) => {
              const damaged = state.storm?.charId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onPick(m.id)}
                  className="flex w-[140px] flex-col items-center pb-2 focus:outline-none"
                  title={`${m.name} — ${m.moodWhy}`}
                >
                  <House charId={m.id} state={state} damaged={damaged} night={night} />
                  <div className="-mt-3">
                    <Chibi char={m.id} mood={m.mood} level={m.level} size={62} />
                  </div>
                  <span
                    className={`rounded-full px-2 text-[10px] font-black ${night ? "bg-white/20 text-white" : "bg-white/70 text-stone-700"}`}
                  >
                    {m.name} {m.moodEmoji}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between bg-white px-4 py-2 text-[10px] font-bold text-stone-400">
        <span>🏘️ Your village lives on real time — it's {night ? "night" : nowMin < 8 * 60 ? "early" : nowMin < 18 * 60 ? "daytime" : "evening"} there too</span>
        <span>tap anyone to visit</span>
      </div>
    </div>
  );
}

export { STORM_SAFE_FURNITURE };
