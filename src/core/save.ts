export type RoomRecord = { deaths: number };

export type SaveData = {
  unlocked: number;
  best: Record<string, RoomRecord>;
  muted: boolean;
};

const KEY = "trap-game.save.v2";

const empty = (): SaveData => ({ unlocked: 0, best: {}, muted: false });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      unlocked: typeof parsed.unlocked === "number" ? parsed.unlocked : 0,
      best: parsed.best && typeof parsed.best === "object" ? parsed.best : {},
      muted: Boolean(parsed.muted),
    };
  } catch {
    return empty();
  }
}

export function persist(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage can be unavailable (private mode); progress just won't persist */
  }
}
