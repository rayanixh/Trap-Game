extends Node2D
##
## One hidden trap. It stays harmless until the player's centre crosses its
## trigger, then runs a small state machine: arming → fire → hold → retract.
##

enum Phase { IDLE, ARMING, FIRE, HOLD, RETRACT, DONE }

const SPIKE_H := 52.0
const CRUSHER_H := 92.0
const SAW_W := 132.0
const SAW_H := 46.0
const FLOOR_Y := 600.0

var def: Dictionary = {}
var phase: Phase = Phase.IDLE
var pos := 0.0
var just_fired := false

var _timer := 0.0
var _vel := 0.0
var _wall_body: StaticBody2D


func setup(trap_def: Dictionary) -> void:
	def = trap_def
	reset()


func reset() -> void:
	phase = Phase.IDLE
	pos = float(def.get("x", 0.0)) if def.get("kind", "") == "saw" else 0.0
	just_fired = false
	_timer = 0.0
	_vel = 0.0
	if _wall_body != null:
		_wall_body.queue_free()
		_wall_body = null
	queue_redraw()


func kind_of() -> String:
	return str(def.get("kind", ""))


func tick(delta: float, player_x: float) -> void:
	just_fired = false
	var kind := kind_of()

	match phase:
		Phase.IDLE:
			if player_x > float(def.get("triggerX", 1e9)):
				phase = Phase.ARMING
				_timer = float(def.get("delay", 0.08))
		Phase.ARMING:
			_timer -= delta
			if _timer <= 0.0:
				phase = Phase.FIRE
				_vel = 0.0
				just_fired = true
				if kind == "floorFall" or kind == "doorShift" or kind == "fakeDoor":
					phase = Phase.DONE
		Phase.FIRE:
			_advance(delta)
		Phase.HOLD:
			_timer -= delta
			if _timer <= 0.0:
				phase = Phase.RETRACT
		Phase.RETRACT:
			var speed := 460.0 if kind == "crusher" else 560.0
			pos -= speed * delta
			if pos <= 0.0:
				pos = 0.0
				phase = Phase.DONE
		Phase.DONE:
			pass

	queue_redraw()


func _advance(delta: float) -> void:
	var kind := kind_of()
	match kind:
		"spikesDrop":
			_vel += 3200.0 * delta
			pos += _vel * delta
			if pos >= FLOOR_Y - SPIKE_H:
				pos = FLOOR_Y - SPIKE_H
				phase = Phase.HOLD
				_timer = float(def.get("hold", 1.2))
		"spikesPop":
			pos += 1100.0 * delta
			if pos >= SPIKE_H:
				pos = SPIKE_H
				phase = Phase.HOLD
				_timer = float(def.get("hold", 0.9))
		"crusher":
			pos += 1000.0 * delta
			if pos >= FLOOR_Y - CRUSHER_H:
				pos = FLOOR_Y - CRUSHER_H
				phase = Phase.HOLD
				_timer = float(def.get("hold", 0.8))
		"saw":
			var target := float(def.get("to", 0.0))
			var direction := -1.0 if target < pos else 1.0
			pos += float(def.get("speed", 480.0)) * direction * delta
			if (direction < 0.0 and pos <= target) or (direction > 0.0 and pos >= target):
				phase = Phase.DONE
		"wall":
			var target := float(def.get("to", 420.0))
			pos += 1200.0 * delta
			if pos >= target:
				pos = target
				phase = Phase.DONE
				_build_wall_body()


func wall_height() -> float:
	return FLOOR_Y - float(def.get("to", FLOOR_Y))


func _build_wall_body() -> void:
	if _wall_body != null:
		return
	_wall_body = StaticBody2D.new()
	var shape := CollisionShape2D.new()
	var box := RectangleShape2D.new()
	box.size = Vector2(float(def.get("w", 100.0)), wall_height())
	shape.shape = box
	shape.position = Vector2(float(def.get("x", 0.0)) + box.size.x * 0.5, pos + box.size.y * 0.5)
	_wall_body.add_child(shape)
	add_child(_wall_body)


## Damage volume for this frame, in room coordinates. Empty when harmless.
func hazard_rect() -> Rect2:
	if phase == Phase.IDLE or phase == Phase.ARMING or phase == Phase.DONE:
		return Rect2()
	if not (phase == Phase.FIRE or phase == Phase.HOLD or phase == Phase.RETRACT):
		return Rect2()

	var kind := kind_of()
	var x := float(def.get("x", 0.0))
	var w := float(def.get("w", 100.0))

	match kind:
		"spikesDrop":
			if pos <= 4.0:
				return Rect2()
			return Rect2(x + 4.0, pos + 6.0, w - 8.0, SPIKE_H - 10.0)
		"spikesPop":
			if pos <= 10.0:
				return Rect2()
			return Rect2(x + 6.0, FLOOR_Y - pos, w - 12.0, pos - 4.0)
		"crusher":
			return Rect2(x + 6.0, pos + 6.0, w - 12.0, CRUSHER_H - 10.0)
		"saw":
			return Rect2(pos + 8.0, FLOOR_Y - SAW_H + 4.0, SAW_W - 16.0, SAW_H - 8.0)
		"wall":
			if phase == Phase.FIRE:
				return Rect2(x, pos, w, wall_height())
	return Rect2()


func is_done() -> bool:
	return phase == Phase.DONE


func _draw() -> void:
	var kind := kind_of()
	var x := float(def.get("x", 0.0))
	var w := float(def.get("w", 100.0))

	match kind:
		"spikesDrop":
			var y := pos
			if phase == Phase.IDLE or phase == Phase.ARMING:
				y = -SPIKE_H + 10.0
			_blit(Assets.sprite("spikes-long"), Rect2(x, y, w, SPIKE_H), true)
			draw_rect(Rect2(x, 0.0, w, 10.0), Color(0.13, 0.15, 0.19, 0.85))
		"spikesPop":
			if pos > 1.0:
				_blit(Assets.sprite("spikes-long"), Rect2(x, FLOOR_Y - pos, w, pos), false)
		"crusher":
			var idle := phase == Phase.IDLE or phase == Phase.ARMING
			var y := -CRUSHER_H + 14.0 if idle else pos
			var cx := x + w * 0.5
			draw_rect(Rect2(cx - 2.0, 0.0, 4.0, maxf(0.0, y) + 4.0), Color(0.23, 0.26, 0.31, 0.55))
			draw_rect(Rect2(cx - 18.0, 0.0, 36.0, 12.0), Color(0.13, 0.15, 0.19, 0.85))
			_blit(Assets.sprite("stone-block"), Rect2(x, y, w, CRUSHER_H), false)
		"saw":
			_blit(Assets.sprite("saw"), Rect2(pos, FLOOR_Y - SAW_H, SAW_W, SAW_H), false)
		"wall":
			var y := -wall_height() + 6.0
			if phase != Phase.IDLE and phase != Phase.ARMING:
				y = pos
			_blit(Assets.sprite("stone-block"), Rect2(x, y, w, wall_height()), false)


## Draw a texture stretched into `rect`, optionally flipped vertically,
## while preserving the caller's rect semantics (top-left).
func _blit(texture: Texture2D, rect: Rect2, flip_y: bool) -> void:
	if texture == null:
		return
	var target := rect
	if flip_y:
		draw_set_transform(Vector2(rect.position.x, rect.position.y + rect.size.y), 0.0, Vector2(1.0, -1.0))
		target = Rect2(Vector2.ZERO, rect.size)
	draw_texture_rect(texture, target, false)
	if flip_y:
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
