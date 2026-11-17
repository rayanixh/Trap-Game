import type { Rect } from "../core/types";

/**
 * A room is a single screen of geometry plus the traps hidden in it.
 * Level Devil style: the room looks calm until you commit, then it cheats.
 */
export type TrapDef = {
  kind: TrapKind;
  /** Left edge of the trap (door traps use it as the decoy door's x). */
  x: number;
  w: number;
  /** The trap fires once the player's centre passes this x. */
  triggerX: number;
  /** Seconds between crossing the trigger and the trap moving. */
  delay?: number;
  /** Seconds the hazard stays out before retracting. */
  hold?: number;
  /** Final top edge for a falling wall, or the sweep target for a saw. */
  to?: number;
  /** Horizontal speed for a saw, in px/s. */
  speed?: number;
  /** Message shown when the trap fires. */
  taunt?: string;
};

export type TrapKind =
  | "spikesDrop"
  | "spikesPop"
  | "crusher"
  | "saw"
  | "wall"
  | "floorFall"
  | "doorShift"
  | "fakeDoor";

export type RoomDecor = { kind: string; x: number; y: number; h?: number };

export type Room = {
  id: string;
  name: string;
  hint: string;
  spawnX: number;
  door: { x: number; hidden?: boolean };
  platforms: Rect[];
  traps: TrapDef[];
  decor: RoomDecor[];
};

export const FLOOR_Y = 600;
export const ROOM_W = 1280;
export const ROOM_H = 720;

const floor = (x: number, w: number, y = FLOOR_Y): Rect => ({ x, y, w, h: ROOM_H - y + 260 });

const decor = (kind: string, x: number, y = FLOOR_Y, h?: number): RoomDecor => ({ kind, x, y, h });

const ROOMS: Room[] = [
  {
    id: "room-1",
    name: "Welcome",
    hint: "The door is right there. What could go wrong?",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      {
        kind: "floorFall",
        x: 560,
        w: 200,
        triggerX: 470,
        delay: 0.06,
        taunt: "The floor was a suggestion.",
      },
    ],
    decor: [decor("tree-large", 60), decor("bush", 300), decor("rock", 980)],
  },
  {
    id: "room-2",
    name: "Ceiling Issues",
    hint: "Watch the ceiling. It watches you.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "spikesDrop", x: 600, w: 190, triggerX: 470, delay: 0.12, hold: 1.5, taunt: "Surprise." },
      { kind: "spikesDrop", x: 940, w: 150, triggerX: 820, delay: 0.1, hold: 1.2 },
    ],
    decor: [decor("tree-round", 60), decor("barrel", 380), decor("plant", 1080)],
  },
  {
    id: "room-3",
    name: "That Door Moved",
    hint: "Doors in the ruins are shy.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "doorShift", x: 1140, w: 120, triggerX: 980, delay: 0.05, to: 200, taunt: "Wrong direction." },
    ],
    decor: [decor("tree-large", 90), decor("crate", 420), decor("stone-pillar", 760, FLOOR_Y, 200)],
  },
  {
    id: "room-4",
    name: "Crush Hour",
    hint: "Some ceilings need to come down.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "crusher", x: 560, w: 170, triggerX: 440, delay: 0.1, hold: 0.9, taunt: "Mind the gap. And the slab." },
    ],
    decor: [decor("tree-large", 60), decor("rock", 900), decor("crate-open", 1040)],
  },
  {
    id: "room-5",
    name: "Watch Your Step",
    hint: "The floor has trust issues.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "floorFall", x: 420, w: 120, triggerX: 330, delay: 0.05 },
      { kind: "floorFall", x: 620, w: 130, triggerX: 540, delay: 0.05 },
      { kind: "floorFall", x: 850, w: 140, triggerX: 780, delay: 0.05, taunt: "Keep running." },
    ],
    decor: [decor("tree-round", 60), decor("bush", 1000)],
  },
  {
    id: "room-6",
    name: "The Saw",
    hint: "The yard keeps its blades sharp.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "saw", x: 1180, w: 132, triggerX: 420, delay: 0.1, to: 120, speed: 520, taunt: "Run at it. Or don't." },
    ],
    decor: [decor("tree-large", 60), decor("barrel", 320), decor("ladder", 980, FLOOR_Y, 140)],
  },
  {
    id: "room-7",
    name: "Double Cross",
    hint: "When the path closes, climb it.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      {
        kind: "wall",
        x: 800,
        w: 110,
        triggerX: 660,
        delay: 0.08,
        to: 420,
        taunt: "The wall is now your friend.",
      },
      { kind: "floorFall", x: 940, w: 130, triggerX: 1000, delay: 0.02 },
    ],
    decor: [decor("tree-large", 60), decor("stone-arch-broken", 480, FLOOR_Y, 120)],
  },
  {
    id: "room-8",
    name: "Spike Surprise",
    hint: "Spikes have excellent timing.",
    spawnX: 96,
    door: { x: 1140 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "spikesPop", x: 470, w: 150, triggerX: 360, delay: 0.05, hold: 0.9 },
      { kind: "spikesPop", x: 700, w: 150, triggerX: 600, delay: 0.05, hold: 0.9, taunt: "Two for two." },
      { kind: "spikesPop", x: 930, w: 150, triggerX: 830, delay: 0.05, hold: 0.9 },
    ],
    decor: [decor("tree-round", 60), decor("plant", 1080)],
  },
  {
    id: "room-9",
    name: "Not That Door",
    hint: "That one looks awfully convenient.",
    spawnX: 96,
    door: { x: 520, hidden: true },
    platforms: [floor(0, ROOM_W)],
    traps: [
      {
        kind: "fakeDoor",
        x: 1040,
        w: 120,
        triggerX: 900,
        delay: 0.4,
        to: 520,
        taunt: "Not that door. This door.",
      },
    ],
    decor: [decor("tree-large", 60), decor("crate", 760), decor("stone-pillar", 880, FLOOR_Y, 200)],
  },
  {
    id: "room-10",
    name: "The Gauntlet",
    hint: "Everything the ruins know, at once.",
    spawnX: 96,
    door: { x: 1160 },
    platforms: [floor(0, ROOM_W)],
    traps: [
      { kind: "spikesDrop", x: 420, w: 150, triggerX: 300, delay: 0.15, hold: 1.1, taunt: "Rules? No." },
      { kind: "floorFall", x: 640, w: 170, triggerX: 560, delay: 0.04 },
      { kind: "saw", x: 1200, w: 132, triggerX: 760, delay: 0.1, to: 380, speed: 560 },
      { kind: "crusher", x: 950, w: 150, triggerX: 870, delay: 0.12, hold: 0.8 },
      { kind: "spikesPop", x: 1090, w: 140, triggerX: 1010, delay: 0.05, hold: 1.0, taunt: "Almost." },
    ],
    decor: [decor("tree-large", 60), decor("barrel", 300), decor("bush", 560), decor("tree-large", 700)],
  },
];

export const ROOM_LIST = ROOMS;
