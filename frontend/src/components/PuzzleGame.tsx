import { useCallback, useEffect, useMemo, useState } from "react";
import { Chibi } from "./chibi/Chibi";
import { CHAR_META, furnitureById, type CharId } from "../lib/crew";

/**
 * Block puzzle (Block-Blast style): 8×8 grid, three offered pieces,
 * clear full rows/columns, chase combos. A crewmate plays beside you.
 * Pays bond and furniture — NEVER XP. Real life is the only XP source.
 */

const SIZE = 8;

type Cell = 0 | 1;
type Grid = Cell[][];
type Shape = [number, number][];

const SHAPES: { shape: Shape; weight: number }[] = [
  { shape: [[0, 0]], weight: 2 },
  { shape: [[0, 0], [0, 1]], weight: 3 },
  { shape: [[0, 0], [1, 0]], weight: 3 },
  { shape: [[0, 0], [0, 1], [0, 2]], weight: 3 },
  { shape: [[0, 0], [1, 0], [2, 0]], weight: 3 },
  { shape: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 3 },
  { shape: [[0, 0], [1, 0], [1, 1]], weight: 2 },
  { shape: [[0, 1], [1, 0], [1, 1]], weight: 2 },
  { shape: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 2 },
  { shape: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 2 },
  { shape: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 2 },
  { shape: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 2 },
  { shape: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]], weight: 1 },
];

function randomShape(): Shape {
  const total = SHAPES.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  for (const s of SHAPES) {
    roll -= s.weight;
    if (roll <= 0) return s.shape;
  }
  return SHAPES[0].shape;
}

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0 as Cell));
}

function canPlace(grid: Grid, shape: Shape, r: number, c: number): boolean {
  return shape.every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && grid[rr][cc] === 0;
  });
}

function anyPlacement(grid: Grid, shape: Shape): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (canPlace(grid, shape, r, c)) return true;
  }
  return false;
}

const CHEERS = ["Nice!", "Ooooh!", "Clean sweep!", "That's the stuff!", "More! More!"];

export function PuzzleGame({
  companion,
  onFinish,
  onQuit,
}: {
  companion: CharId;
  onFinish: (score: number) => { dropId: string | null };
  onQuit: () => void;
}) {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [pieces, setPieces] = useState<(Shape | null)[]>([randomShape(), randomShape(), randomShape()]);
  const [selected, setSelected] = useState<number | null>(0);
  const [score, setScore] = useState(0);
  const [cheer, setCheer] = useState<string | null>(null);
  const [over, setOver] = useState<{ dropId: string | null } | null>(null);

  const alive = useMemo(
    () => pieces.some((p) => p !== null && anyPlacement(grid, p)),
    [pieces, grid]
  );

  useEffect(() => {
    if (!alive && !over) {
      const result = onFinish(score);
      setOver(result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive]);

  const place = useCallback(
    (r: number, c: number) => {
      if (selected === null || over) return;
      const shape = pieces[selected];
      if (!shape || !canPlace(grid, shape, r, c)) return;
      const next = grid.map((row) => [...row]) as Grid;
      for (const [dr, dc] of shape) next[r + dr][c + dc] = 1;
      let gained = shape.length * 10;
      // clear full rows/cols
      const fullRows: number[] = [];
      const fullCols: number[] = [];
      for (let i = 0; i < SIZE; i++) {
        if (next[i].every((x) => x === 1)) fullRows.push(i);
        if (next.every((row) => row[i] === 1)) fullCols.push(i);
      }
      const lines = fullRows.length + fullCols.length;
      if (lines > 0) {
        for (const i of fullRows) for (let c2 = 0; c2 < SIZE; c2++) next[i][c2] = 0;
        for (const i of fullCols) for (let r2 = 0; r2 < SIZE; r2++) next[r2][i] = 0;
        gained += lines * 80 + (lines > 1 ? (lines - 1) * 60 : 0);
        setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
        window.setTimeout(() => setCheer(null), 1400);
      }
      const newPieces = pieces.map((p, i) => (i === selected ? null : p));
      const refilled = newPieces.every((p) => p === null)
        ? [randomShape(), randomShape(), randomShape()]
        : newPieces;
      setGrid(next);
      setScore((s) => s + gained);
      setPieces(refilled);
      const nextSel = refilled.findIndex((p) => p !== null);
      setSelected(nextSel === -1 ? null : nextSel);
    },
    [grid, pieces, selected, over]
  );

  const drop = over?.dropId ? furnitureById(over.dropId) : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto bg-sky-950 px-4 py-6 text-white">
      <div className="flex w-full max-w-sm items-center justify-between">
        <button onClick={onQuit} className="text-xs font-bold text-sky-400">
          ← quit
        </button>
        <div className="text-lg font-black text-amber-300">{score}</div>
        <div className="w-10" />
      </div>

      <div className="mt-2 flex w-full max-w-sm items-end gap-2">
        <div className="relative">
          <Chibi char={companion} mood={cheer ? "happy" : "neutral"} size={64} />
          {cheer && (
            <div className="pop-in absolute -top-2 left-14 whitespace-nowrap rounded-2xl rounded-bl-none bg-white px-2 py-1 text-[10px] font-black text-sky-900">
              {cheer}
            </div>
          )}
        </div>
        <p className="mb-2 flex-1 text-[10px] font-bold text-sky-300">
          {CHAR_META[companion].name} is watching your every move. No pressure.
        </p>
      </div>

      {/* Grid */}
      <div
        className="mt-2 grid gap-0.5 rounded-2xl bg-sky-900 p-1.5"
        style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, width: "min(92vw, 22rem)" }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const valid =
              selected !== null && pieces[selected] ? canPlace(grid, pieces[selected]!, r, c) : false;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => place(r, c)}
                className={`aspect-square rounded-md transition ${
                  cell ? "bg-amber-400" : valid ? "bg-sky-700/80" : "bg-sky-800/60"
                }`}
              />
            );
          })
        )}
      </div>

      {/* Pieces */}
      <div className="mt-3 flex w-full max-w-sm items-center justify-around">
        {pieces.map((p, i) => (
          <button
            key={i}
            disabled={!p}
            onClick={() => setSelected(i)}
            className={`rounded-2xl p-2 transition ${
              selected === i ? "bg-sky-800 ring-2 ring-amber-400" : "bg-sky-900"
            } ${!p ? "opacity-20" : ""}`}
          >
            {p ? (
              <div
                className="grid gap-0.5"
                style={{
                  gridTemplateRows: `repeat(${Math.max(...p.map(([r]) => r)) + 1}, 14px)`,
                  gridTemplateColumns: `repeat(${Math.max(...p.map(([, c]) => c)) + 1}, 14px)`,
                }}
              >
                {p.map(([r, c], j) => (
                  <div
                    key={j}
                    className="rounded-sm bg-amber-400"
                    style={{ gridRow: r + 1, gridColumn: c + 1 }}
                  />
                ))}
              </div>
            ) : (
              <div className="h-6 w-6" />
            )}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-bold text-sky-500">
        Tap a piece, then tap the board (top-left corner of where it lands). Full rows and columns
        clear.
      </p>

      {/* Game over */}
      {over && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-sky-950/97 px-6 text-center">
          <Chibi char={companion} mood="happy" size={110} />
          <h1 className="mt-3 text-2xl font-black text-amber-300">{score} points!</h1>
          <p className="mt-2 text-sm font-bold text-sky-200">+3 bond with {CHAR_META[companion].name} 💛</p>
          {drop ? (
            <div className="pop-in mt-4 rounded-3xl bg-sky-900 px-6 py-4">
              <div className="text-4xl">{drop.emoji}</div>
              <p className="mt-1 text-sm font-black text-white">You won: {drop.title}!</p>
              <p className="text-[10px] font-bold text-sky-400">It's in your crate — place it in a home.</p>
            </div>
          ) : (
            <p className="mt-3 text-xs font-bold text-sky-400">
              300+ points wins furniture. 1200+ wins the rare stuff. Next time!
            </p>
          )}
          <button
            onClick={onQuit}
            className="mt-6 w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-black text-sky-950 shadow-lg hover:bg-amber-300"
          >
            Back to the crew ⚓
          </button>
        </div>
      )}
    </div>
  );
}
