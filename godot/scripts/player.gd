extends CharacterBody2D
##
## Feet-anchored platformer controller: the node position is the player's feet,
## so room spawn points and traps can be expressed in the same space.
##

signal jumped
signal landed(impact: float)

const SPEED := 320.0
const ACCEL_GROUND := 2600.0
const ACCEL_AIR := 1700.0
const FRICTION := 2800.0
const GRAVITY := 2400.0
const GRAVITY_ASCEND := 1850.0
const JUMP_VELOCITY := 900.0
const MAX_FALL := 1350.0
const COYOTE_TIME := 0.1
const JUMP_BUFFER := 0.12
const SPRITE_HEIGHT := 118.0
const HITBOX := Vector2(32.0, 64.0)

var active := false
var dead := false
var facing := 1

# on-screen pad state, pushed in by the game each physics frame
var ext_left := false
var ext_right := false
var ext_jump := false
var ext_jump_pressed := false

var _coyote := 0.0
var _buffer := 0.0
var _land_timer := 0.0
var _was_on_floor := true

@onready var sprite: AnimatedSprite2D = $Sprite


func _ready() -> void:
	_build_sprite_frames()
	var cell: Vector2 = Assets.player_cell()
	if cell.y > 0.0:
		var factor := SPRITE_HEIGHT / cell.y
		sprite.scale = Vector2(factor, factor)
		# keep the frame's feet exactly on the node origin
		sprite.offset = Vector2(0.0, -cell.y * 0.5)
	sprite.play("idle")


func _build_sprite_frames() -> void:
	var frames := SpriteFrames.new()
	if frames.has_animation("default"):
		frames.remove_animation("default")
	_add_animation(frames, "idle", "idle", 0, 4, 5.0, true)
	_add_animation(frames, "run", "run", 0, 8, 14.0, true)
	_add_animation(frames, "jump_up", "jump", 0, 4, 10.0, false)
	_add_animation(frames, "fall", "jump", 4, 4, 10.0, false)
	_add_animation(frames, "land", "land", 0, 4, 12.0, false)
	sprite.sprite_frames = frames


func _add_animation(
	frames: SpriteFrames,
	name: String,
	source: String,
	first: int,
	count: int,
	fps: float,
	loop: bool
) -> void:
	frames.add_animation(name)
	frames.set_animation_speed(name, fps)
	frames.set_animation_loop(name, loop)
	for i in count:
		var texture := Assets.player_frame(source, first + i)
		if texture != null:
			frames.add_frame(name, texture)


func respawn(at: Vector2) -> void:
	position = at
	velocity = Vector2.ZERO
	dead = false
	_coyote = 0.0
	_buffer = 0.0
	_land_timer = 0.0
	_was_on_floor = true
	facing = 1
	visible = true
	sprite.play("idle")


func die() -> void:
	dead = true
	active = false


func hit_rect() -> Rect2:
	return Rect2(
		position.x - HITBOX.x * 0.5,
		position.y - HITBOX.y,
		HITBOX.x,
		HITBOX.y
	)


func _physics_process(delta: float) -> void:
	var on_floor := is_on_floor()
	if on_floor:
		_coyote = COYOTE_TIME
	else:
		_coyote = maxf(0.0, _coyote - delta)

	var axis := 0.0
	if active and not dead:
		axis = Input.get_axis("move_left", "move_right")
		if absf(axis) < 0.01:
			axis = (1.0 if ext_right else 0.0) - (1.0 if ext_left else 0.0)

	if absf(axis) > 0.01:
		facing = 1 if axis > 0.0 else -1
		var accel := ACCEL_GROUND if on_floor else ACCEL_AIR
		velocity.x = move_toward(velocity.x, axis * SPEED, accel * delta)
	else:
		var drag := FRICTION if on_floor else FRICTION * 0.35
		velocity.x = move_toward(velocity.x, 0.0, drag * delta)

	var jump_pressed := Input.is_action_just_pressed("jump") or ext_jump_pressed
	ext_jump_pressed = false
	if active and not dead and jump_pressed:
		_buffer = JUMP_BUFFER
	else:
		_buffer = maxf(0.0, _buffer - delta)

	if _buffer > 0.0 and _coyote > 0.0 and not dead:
		velocity.y = -JUMP_VELOCITY
		_buffer = 0.0
		_coyote = 0.0
		_land_timer = 0.0
		jumped.emit()

	var gravity := GRAVITY
	if velocity.y < 0.0:
		var holding := Input.is_action_pressed("jump") or ext_jump
		gravity = GRAVITY_ASCEND if holding and not dead else GRAVITY * 1.5
	velocity.y = minf(velocity.y + gravity * delta, MAX_FALL)

	var fall_speed := velocity.y
	move_and_slide()

	if is_on_floor() and not _was_on_floor and fall_speed > 240.0:
		_land_timer = 0.19
		landed.emit(clampf(fall_speed / MAX_FALL, 0.0, 1.0))

	_was_on_floor = is_on_floor()
	if _land_timer > 0.0:
		_land_timer = maxf(0.0, _land_timer - delta)

	_update_animation()
	sprite.flip_h = facing < 0


func _update_animation() -> void:
	var target := "idle"
	if not is_on_floor():
		target = "jump_up" if velocity.y < 0.0 else "fall"
	elif _land_timer > 0.0:
		target = "land"
	elif absf(velocity.x) > 24.0:
		target = "run"
	if sprite.animation != target:
		sprite.play(target)
