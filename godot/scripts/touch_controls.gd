extends Control
##
## On-screen movement pad: left, right and jump, drawn over the game so the same
## build is playable with a mouse, a finger or a touchscreen laptop.
##
## It emits held/released signals; the game turns those into player input.
##

signal move_left_changed(down: bool)
signal move_right_changed(down: bool)
signal jump_changed(down: bool)

const W := 1280.0
const H := 720.0
const PAD := 96.0
const JUMP_SIZE := 124.0
const MARGIN := 24.0
const BOTTOM := 22.0

const IDLE_BG := Color(0.04, 0.06, 0.1, 0.4)
const PRESSED_BG := Color(0.98, 0.85, 0.45, 0.82)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	var pad_y := H - BOTTOM - PAD
	_make_button("◀", Rect2(MARGIN, pad_y, PAD, PAD), "move_left_changed", 40)
	_make_button("▶", Rect2(MARGIN + PAD + 16.0, pad_y, PAD, PAD), "move_right_changed", 40)
	_make_button(
		"JUMP",
		Rect2(W - MARGIN - JUMP_SIZE, H - BOTTOM - JUMP_SIZE, JUMP_SIZE, JUMP_SIZE),
		"jump_changed",
		24
	)


func _make_button(label: String, rect: Rect2, signal_name: String, font_size: int) -> void:
	var button := Button.new()
	button.text = label
	button.position = rect.position
	button.size = rect.size
	button.focus_mode = Control.FOCUS_NONE
	button.mouse_filter = Control.MOUSE_FILTER_STOP

	button.add_theme_stylebox_override("normal", _style(IDLE_BG, Color(1.0, 1.0, 1.0, 0.35)))
	button.add_theme_stylebox_override("hover", _style(Color(0.06, 0.09, 0.14, 0.55), Color(1.0, 1.0, 1.0, 0.5)))
	button.add_theme_stylebox_override("pressed", _style(PRESSED_BG, Color(1.0, 0.95, 0.8, 0.9)))
	button.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), Color(0, 0, 0, 0)))
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", Color(0.96, 0.98, 1.0, 0.92))
	button.add_theme_color_override("font_hover_color", Color(1.0, 1.0, 1.0, 1.0))
	button.add_theme_color_override("font_pressed_color", Color(0.12, 0.1, 0.05, 1.0))

	button.button_down.connect(func() -> void: emit_signal(signal_name, true))
	button.button_up.connect(func() -> void: emit_signal(signal_name, false))
	add_child(button)


func _style(background: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = background
	box.border_color = border
	box.set_border_width_all(2)
	box.set_corner_radius_all(26)
	return box


## Safety net: a pointer released outside a button must never leave input stuck.
func _input(event: InputEvent) -> void:
	var released := false
	if event is InputEventMouseButton:
		released = not event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	elif event is InputEventScreenTouch:
		released = not event.pressed
	if released:
		move_left_changed.emit(false)
		move_right_changed.emit(false)
		jump_changed.emit(false)
