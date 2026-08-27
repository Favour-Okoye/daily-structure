export function ComingSoon({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-sky-100">
      <div className="idle-bob inline-block text-6xl">{emoji}</div>
      <h1 className="mt-4 text-lg font-black text-sky-900">{title}</h1>
      <p className="mt-2 text-sm font-semibold text-stone-500">{body}</p>
    </div>
  );
}

export function CrewSoon() {
  return (
    <ComingSoon
      emoji="👒"
      title="The crew is on its way"
      body="Luffy, Zoro and Nami board in the next update — with moods, bonds, and opinions about your day. Keep the deck ready."
    />
  );
}

export function TasksSoon() {
  return (
    <ComingSoon
      emoji="🗺️"
      title="Charting the course"
      body="Deadline tasks with urgency that ramps as the day approaches — and Nami slotting them into your real free hours. Coming right after the crew."
    />
  );
}

export function WeekSoon() {
  return (
    <ComingSoon
      emoji="🌊"
      title="The voyage log"
      body="Sunday recaps, weekly goals you pick yourself, and the story of your week. Sailing in soon."
    />
  );
}
