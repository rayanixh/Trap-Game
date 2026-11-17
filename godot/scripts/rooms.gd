extends RefCounted
##
## Room data. Each room is one screen: the player spawns left, the door waits
## right, and every trap below stays hidden until its trigger is crossed.
##
## Trap fields:
##   kind      floorFall | spikesDrop | spikesPop | crusher | saw | wall |
##             doorShift | fakeDoor
##   x, w      horizontal span (door traps use x as the decoy door position)
##   triggerX  fires once the player's centre passes this
##   delay     seconds between the trigger and the trap moving
##   hold      seconds a hazard stays out before retracting
##   to        final top edge for a wall, sweep target for a saw, door target
##   speed     saw speed in px/s
##   taunt     line shown when the trap springs
##

const FLOOR_Y := 600.0
const ROOM_W := 1280.0
const ROOM_H := 720.0

const ROOMS := [
	{
		"id": "room-1",
		"name": "Welcome",
		"hint": "The door is right there. What could go wrong?",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "floorFall", "x": 560.0, "w": 200.0,
				"triggerX": 470.0, "delay": 0.06,
				"taunt": "The floor was a suggestion.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "bush", "x": 300.0},
			{"kind": "rock", "x": 980.0},
		],
	},
	{
		"id": "room-2",
		"name": "Ceiling Issues",
		"hint": "Watch the ceiling. It watches you.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "spikesDrop", "x": 600.0, "w": 190.0,
				"triggerX": 470.0, "delay": 0.12, "hold": 1.5,
				"taunt": "Surprise.",
			},
			{
				"kind": "spikesDrop", "x": 940.0, "w": 150.0,
				"triggerX": 820.0, "delay": 0.1, "hold": 1.2,
			},
		],
		"decor": [
			{"kind": "tree-round", "x": 60.0},
			{"kind": "barrel", "x": 380.0},
			{"kind": "plant", "x": 1080.0},
		],
	},
	{
		"id": "room-3",
		"name": "That Door Moved",
		"hint": "Doors in the ruins are shy.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "doorShift", "x": 1140.0, "w": 120.0,
				"triggerX": 980.0, "delay": 0.05, "to": 200.0,
				"taunt": "Wrong direction.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 90.0},
			{"kind": "crate", "x": 420.0},
			{"kind": "stone-pillar", "x": 760.0, "h": 200.0},
		],
	},
	{
		"id": "room-4",
		"name": "Crush Hour",
		"hint": "Some ceilings need to come down.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "crusher", "x": 560.0, "w": 170.0,
				"triggerX": 440.0, "delay": 0.1, "hold": 0.9,
				"taunt": "Mind the gap. And the slab.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "rock", "x": 900.0},
			{"kind": "crate-open", "x": 1040.0},
		],
	},
	{
		"id": "room-5",
		"name": "Watch Your Step",
		"hint": "The floor has trust issues.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{"kind": "floorFall", "x": 420.0, "w": 120.0, "triggerX": 330.0, "delay": 0.05},
			{"kind": "floorFall", "x": 620.0, "w": 130.0, "triggerX": 540.0, "delay": 0.05},
			{
				"kind": "floorFall", "x": 850.0, "w": 140.0,
				"triggerX": 780.0, "delay": 0.05,
				"taunt": "Keep running.",
			},
		],
		"decor": [
			{"kind": "tree-round", "x": 60.0},
			{"kind": "bush", "x": 1000.0},
		],
	},
	{
		"id": "room-6",
		"name": "The Saw",
		"hint": "The yard keeps its blades sharp.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "saw", "x": 1180.0, "w": 132.0,
				"triggerX": 420.0, "delay": 0.1, "to": 120.0, "speed": 520.0,
				"taunt": "Jump it. Or don't.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "barrel", "x": 320.0},
			{"kind": "ladder", "x": 980.0, "h": 140.0},
		],
	},
	{
		"id": "room-7",
		"name": "Double Cross",
		"hint": "When the path closes, climb it.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "wall", "x": 800.0, "w": 110.0,
				"triggerX": 660.0, "delay": 0.08, "to": 420.0,
				"taunt": "The wall is now your friend.",
			},
			{"kind": "floorFall", "x": 940.0, "w": 130.0, "triggerX": 1000.0, "delay": 0.02},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "stone-arch-broken", "x": 480.0, "h": 120.0},
		],
	},
	{
		"id": "room-8",
		"name": "Spike Surprise",
		"hint": "Spikes have excellent timing.",
		"spawn": 96.0,
		"door": {"x": 1140.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{"kind": "spikesPop", "x": 470.0, "w": 150.0, "triggerX": 360.0, "delay": 0.05, "hold": 0.9},
			{
				"kind": "spikesPop", "x": 700.0, "w": 150.0,
				"triggerX": 600.0, "delay": 0.05, "hold": 0.9,
				"taunt": "Two for two.",
			},
			{"kind": "spikesPop", "x": 930.0, "w": 150.0, "triggerX": 830.0, "delay": 0.05, "hold": 0.9},
		],
		"decor": [
			{"kind": "tree-round", "x": 60.0},
			{"kind": "plant", "x": 1080.0},
		],
	},
	{
		"id": "room-9",
		"name": "Not That Door",
		"hint": "That one looks awfully convenient.",
		"spawn": 96.0,
		"door": {"x": 520.0, "hidden": true},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "fakeDoor", "x": 1040.0, "w": 120.0,
				"triggerX": 900.0, "delay": 0.4, "to": 520.0,
				"taunt": "Not that door. This door.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "crate", "x": 760.0},
			{"kind": "stone-pillar", "x": 880.0, "h": 200.0},
		],
	},
	{
		"id": "room-10",
		"name": "The Gauntlet",
		"hint": "Everything the ruins know, at once.",
		"spawn": 96.0,
		"door": {"x": 1160.0, "hidden": false},
		"platforms": [[0.0, 600.0, 1280.0, 380.0]],
		"traps": [
			{
				"kind": "spikesDrop", "x": 420.0, "w": 150.0,
				"triggerX": 300.0, "delay": 0.15, "hold": 1.1,
				"taunt": "Rules? No.",
			},
			{"kind": "floorFall", "x": 640.0, "w": 170.0, "triggerX": 560.0, "delay": 0.04},
			{
				"kind": "saw", "x": 1200.0, "w": 132.0,
				"triggerX": 760.0, "delay": 0.1, "to": 380.0, "speed": 560.0,
			},
			{"kind": "crusher", "x": 950.0, "w": 150.0, "triggerX": 870.0, "delay": 0.12, "hold": 0.8},
			{
				"kind": "spikesPop", "x": 1090.0, "w": 140.0,
				"triggerX": 1010.0, "delay": 0.05, "hold": 1.0,
				"taunt": "Almost.",
			},
		],
		"decor": [
			{"kind": "tree-large", "x": 60.0},
			{"kind": "barrel", "x": 300.0},
			{"kind": "bush", "x": 560.0},
			{"kind": "tree-round", "x": 700.0},
		],
	},
]
