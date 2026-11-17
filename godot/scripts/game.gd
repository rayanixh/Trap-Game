extends Node2D
##
## Trap Game — a Level Devil style trap platformer.
##
## Owns the room lifecycle: build a room from data, watch for traps firing,
## kill the player on contact, and restart the room instantly on death.
##

enum State { TITLE, PLAY, PAUSED, DEAD, CLEAR, VICTORY }

const PLATFORM_SCRIPT := preload("res://scripts/platform.gd")
const TRAP_SCRIPT := preload("res://scripts/trap.gd")
const BACKDROP_SCRIPT := preload("res://scripts/backdrop.gd")
const HUD_SCRIPT := preload("res://scripts/hud.gd")
const PLAYER_SCENE := preload("res://scenes/player.tscn")
const ROOMS_DATA := preload("res://scripts/rooms.gd")

const ROOMS: Array = ROOMS_DATA.ROOMS
const FLOOR_Y := 600.0
const ROOM_W := 1280.0
const ROOM_H := 720.0
const DOOR_HEIGHT := 190.0
const SAVE_PATH := "user://trap_game.cfg"

var state: State = State.TITLE
var room_index := 0
var title_pick := 0
var room: Dictionary = {}

var room_root: Node2D
var platforms: Array = []
var traps: Array = []
var door_sprite: Sprite2D
var decoy_sprite: Sprite2D
var door_x := 0.0
var door_hidden := false

var player
var hud

var deaths := 0
var hint_timer := 0.0
var taunt := ""
var taunt_timer := 0.0
var death_timer := 0.0

var unlocked := 0
var best: Dictionary = {}
var muted := false

var _audio_pool: Array[AudioStreamPlayer] = []
var _audio_streams: Dictionary = {}
var _next_player := 0


func _ready() -> void:
	_setup_input()
	_load_save()
	_setup_audio()

	var backdrop := Node2D.new()
	backdrop.set_script(BACKDROP_SCRIPT)
	add_child(backdrop)

	room_root = Node2D.new()
	add_child(room_root)

	player = PLAYER_SCENE.instantiate()
	add_child(player)
	player.jumped.connect(func() -> void: _play("jump"))
	player.landed.connect(func(_impact: float) -> void: _play("land"))

	var layer := CanvasLayer.new()
	add_child(layer)
	hud = HUD_SCRIPT.new()
	layer.add_child(hud)

	title_pick = clampi(unlocked, 0, ROOMS.size() - 1)
	_build_room(title_pick)
	_set_state(State.TITLE)


# ----------------------------------------------------------------- input setup

func _setup_input() -> void:
	_ensure_action("move_left", [KEY_LEFT, KEY_A])
	_ensure_action("move_right", [KEY_RIGHT, KEY_D])
	_ensure_action("jump", [KEY_SPACE, KEY_W, KEY_UP, KEY_Z])
	_ensure_action("restart", [KEY_R])
	_ensure_action("pause", [KEY_P, KEY_ESCAPE])
	_ensure_action("mute", [KEY_M])
	_ensure_action("confirm", [KEY_ENTER, KEY_KP_ENTER])


func _ensure_action(action: String, keys: Array) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	for key in keys:
		var event := InputEventKey.new()
		event.physical_keycode = key
		InputMap.action_add_event(action, event)


# --------------------------------------------------------------------- audio

func _setup_audio() -> void:
	for i in 4:
		var voice := AudioStreamPlayer.new()
		voice.volume_db = -6.0
		add_child(voice)
		_audio_pool.append(voice)

	for sound_name in ["jump", "land", "hit", "die", "clear", "click", "deny"]:
		var path := "res://assets/audio/%s.wav" % sound_name
		if ResourceLoader.exists(path):
			_audio_streams[sound_name] = load(path)

	AudioServer.set_bus_mute(0, muted)


func _play(sound_name: String) -> void:
	if muted or not _audio_streams.has(sound_name):
		return
	var voice: AudioStreamPlayer = _audio_pool[_next_player]
	_next_player = (_next_player + 1) % _audio_pool.size()
	voice.stream = _audio_streams[sound_name]
	voice.play()


# ---------------------------------------------------------------------- save

func _load_save() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) != OK:
		return
	unlocked = int(config.get_value("progress", "unlocked", 0))
	muted = bool(config.get_value("progress", "muted", false))
	if config.has_section("best"):
		for key in config.get_section_keys("best"):
			best[key] = int(config.get_value("best", key))


func _save() -> void:
	var config := ConfigFile.new()
	config.set_value("progress", "unlocked", unlocked)
	config.set_value("progress", "muted", muted)
	for key in best.keys():
		config.set_value("best", key, best[key])
	config.save(SAVE_PATH)


# --------------------------------------------------------------------- rooms

func _build_room(index: int) -> void:
	room_index = clampi(index, 0, ROOMS.size() - 1)
	room = ROOMS[room_index]

	if room_root != null:
		room_root.queue_free()
	room_root = Node2D.new()
	add_child(room_root)

	platforms.clear()
	traps.clear()
	door_sprite = null
	decoy_sprite = null

	for rect in room["platforms"]:
		_spawn_platform(Rect2(rect[0], rect[1], rect[2], rect[3]))

	for def in room["traps"]:
		_spawn_trap(def)

	door_x = float(room["door"]["x"])
	door_hidden = bool(room["door"].get("hidden", false))
	door_sprite = Assets.make_sprite("door", DOOR_HEIGHT)
	door_sprite.position = Vector2(door_x, FLOOR_Y + 4.0)
	door_sprite.visible = not door_hidden
	room_root.add_child(door_sprite)

	for def in room["traps"]:
		if str(def.get("kind", "")) == "fakeDoor":
			decoy_sprite = Assets.make_sprite("door", DOOR_HEIGHT)
			decoy_sprite.position = Vector2(float(def["x"]), FLOOR_Y + 4.0)
			room_root.add_child(decoy_sprite)

	for decor in room.get("decor", []):
		var sprite := Assets.make_sprite(str(decor["kind"]), float(decor.get("h", 0.0)))
		if float(decor.get("h", 0.0)) <= 0.0:
			var natural := Assets.sprite_size(str(decor["kind"]))
			sprite = Assets.make_sprite(str(decor["kind"]), natural.y)
		sprite.position = Vector2(float(decor["x"]), FLOOR_Y + 4.0)
		sprite.z_index = -1
		room_root.add_child(sprite)

	deaths = 0
	hint_timer = 3.4
	taunt = ""
	taunt_timer = 0.0
	death_timer = 0.0

	player.respawn(Vector2(float(room["spawn"]), FLOOR_Y))
	_refresh_hud()


func _spawn_platform(rect: Rect2):
	var platform = PLATFORM_SCRIPT.new()
	platform.position = rect.position
	platform.setup(rect.size)
	room_root.add_child(platform)
	platforms.append(platform)
	return platform


func _spawn_trap(def: Dictionary):
	var trap = TRAP_SCRIPT.new()
	trap.setup(def)
	room_root.add_child(trap)
	traps.append(trap)
	return trap


# ---------------------------------------------------------------- state flow

func _set_state(next_state: State) -> void:
	state = next_state
	player.active = state == State.PLAY
	if state == State.PLAY:
		player.dead = false
	_refresh_hud()


func _start_room(index: int) -> void:
	_build_room(index)
	_set_state(State.PLAY)
	_play("click")


func _retry_room() -> void:
	var kept_deaths := deaths
	_build_room(room_index)
	deaths = kept_deaths
	_set_state(State.PLAY)


func _next_room() -> void:
	if room_index + 1 >= ROOMS.size():
		_set_state(State.VICTORY)
		return
	title_pick = room_index + 1
	_start_room(room_index + 1)


func _to_title() -> void:
	_build_room(title_pick)
	_set_state(State.TITLE)


func _die() -> void:
	if state != State.PLAY:
		return
	player.die()
	deaths += 1
	death_timer = 0.75
	_play("die")
	_set_state(State.DEAD)


func _clear_room() -> void:
	var room_id := str(room["id"])
	var previous := int(best.get(room_id, -1))
	if previous < 0 or deaths < previous:
		best[room_id] = deaths
	unlocked = mini(ROOMS.size() - 1, maxi(unlocked, room_index + 1))
	_save()
	_play("clear")
	_set_state(State.CLEAR)


func _door_rect() -> Rect2:
	return Rect2(door_x - 58.0, FLOOR_Y - 165.0, 116.0, 165.0)


# ------------------------------------------------------------------ main loop

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("mute"):
		muted = not muted
		AudioServer.set_bus_mute(0, muted)
		_save()

	if event.is_action_pressed("pause"):
		if state == State.PLAY:
			_set_state(State.PAUSED)
		elif state == State.PAUSED:
			_set_state(State.PLAY)

	if event.is_action_pressed("restart"):
		if state == State.PLAY or state == State.PAUSED:
			_retry_room()

	if event.is_action_pressed("confirm"):
		match state:
			State.TITLE:
				_start_room(title_pick)
			State.CLEAR:
				_next_room()
			State.VICTORY:
				_to_title()
			State.PAUSED:
				_set_state(State.PLAY)

	if event.is_action_pressed("jump"):
		match state:
			State.TITLE:
				_start_room(title_pick)
			State.CLEAR:
				_next_room()
			State.VICTORY:
				_to_title()

	if state == State.TITLE:
		if event.is_action_pressed("move_left"):
			title_pick = maxi(0, title_pick - 1)
			_build_room(title_pick)
		elif event.is_action_pressed("move_right"):
			title_pick = mini(unlocked, title_pick + 1)
			_build_room(title_pick)


func _process(delta: float) -> void:
	if hint_timer > 0.0:
		hint_timer = maxf(0.0, hint_timer - delta)
	if taunt_timer > 0.0:
		taunt_timer = maxf(0.0, taunt_timer - delta)
	hud.queue_redraw()


func _physics_process(delta: float) -> void:
	match state:
		State.PLAY:
			_tick_play(delta)
		State.DEAD:
			death_timer -= delta
			if death_timer <= 0.0:
				_retry_room()
		_:
			pass


func _tick_play(delta: float) -> void:
	var player_x: float = player.position.x

	for trap in traps.duplicate():
		if not is_instance_valid(trap):
			continue
		trap.tick(delta, player_x)
		if trap.just_fired:
			_on_trap_fired(trap)

	var body: Rect2 = player.hit_rect()
	for trap in traps:
		if not is_instance_valid(trap):
			continue
		var hazard: Rect2 = trap.hazard_rect()
		if hazard.size != Vector2.ZERO and hazard.intersects(body):
			_die()
			return

	if player.position.y > ROOM_H + 40.0:
		_die()
		return

	if not door_hidden and _door_rect().intersects(body):
		_clear_room()


func _on_trap_fired(trap) -> void:
	var def: Dictionary = trap.def
	if def.has("taunt"):
		taunt = str(def["taunt"])
		taunt_timer = 2.4

	match str(def.get("kind", "")):
		"floorFall":
			_carve_floor(float(def["x"]), float(def["w"]))
			_play("land")
		"doorShift":
			_move_door(float(def.get("to", door_x)))
			_play("click")
		"fakeDoor":
			_reveal_door(def)
			_play("deny")
		_:
			_play("deny")


func _carve_floor(x: float, width: float) -> void:
	var updated: Array = []
	for platform in platforms:
		if not is_instance_valid(platform):
			continue
		var rect := Rect2(platform.global_position, platform.rect_size)
		var same_row := absf(rect.position.y - FLOOR_Y) < 2.0
		var overlaps := rect.position.x < x + width and rect.position.x + rect.size.x > x
		if same_row and overlaps:
			var pieces: Array = platform.carve(x, width)
			for piece in pieces:
				updated.append(_spawn_platform(piece))
		else:
			updated.append(platform)
	platforms = updated


func _move_door(target_x: float) -> void:
	door_x = target_x
	if door_sprite != null:
		door_sprite.position.x = door_x


func _reveal_door(def: Dictionary) -> void:
	if decoy_sprite != null:
		decoy_sprite.queue_free()
		decoy_sprite = null
	door_hidden = false
	door_x = float(def.get("to", door_x))
	if door_sprite != null:
		door_sprite.visible = true
		door_sprite.position.x = door_x
	# the decoy bites back
	_spawn_trap({
		"kind": "spikesPop",
		"x": float(def["x"]),
		"w": float(def["w"]),
		"triggerX": -1.0,
		"delay": 0.02,
		"hold": 1.4,
	})


func _refresh_hud() -> void:
	if hud == null:
		return
	hud.mode = _mode_name()
	hud.room_name = str(room.get("name", ""))
	hud.room_index = room_index
	hud.room_count = ROOMS.size()
	hud.deaths = deaths
	hud.hint = str(room.get("hint", ""))
	hud.hint_timer = hint_timer
	hud.taunt = taunt
	hud.taunt_timer = taunt_timer
	hud.title_pick = title_pick
	hud.unlocked = unlocked
	hud.best_deaths = int(best.get(str(room.get("id", "")), -1))
	hud.panel_title = "Room Cleared"
	hud.panel_subtitle = str(room.get("name", ""))
	hud.panel_lines = ["Deaths %d" % deaths]
	hud.panel_footer = "Press ENTER for the next room"
	if hud.mode == "victory":
		hud.panel_title = "You Beat The Ruins"
		hud.panel_subtitle = "Every trap, every lie, every door."
		hud.panel_lines = ["Rooms %d" % ROOMS.size()]
		hud.panel_footer = "Press ENTER to return to the title"
	hud.queue_redraw()


func _mode_name() -> String:
	match state:
		State.TITLE:
			return "title"
		State.PAUSED:
			return "paused"
		State.DEAD:
			return "dead"
		State.CLEAR:
			return "clear"
		State.VICTORY:
			return "victory"
		_:
			return "play"
