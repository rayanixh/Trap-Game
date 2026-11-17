extends Control
##
## Everything the player reads: room label, death count, taunts, hints and the
## title / pause / clear panels. Drawn straight onto the canvas for precision.
##

const W := 1280.0
const H := 720.0
const WHITE := Color(0.95, 0.97, 1.0)

var mode := "play"
var room_name := ""
var room_index := 0
var room_count := 10
var deaths := 0
var hint := ""
var hint_timer := 0.0
var taunt := ""
var taunt_timer := 0.0
var title_pick := 0
var unlocked := 0
var best_deaths := -1
var panel_title := ""
var panel_subtitle := ""
var panel_lines: Array = []
var panel_footer := ""


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _font() -> Font:
	return ThemeDB.fallback_font


func _text(value: String, pos: Vector2, size: int, color: Color) -> void:
	var font := _font()
	if font == null:
		return
	draw_string(font, pos, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)


func _text_centered(value: String, y: float, size: int, color: Color) -> void:
	var font := _font()
	if font == null:
		return
	draw_string(font, Vector2(0.0, y), value, HORIZONTAL_ALIGNMENT_CENTER, W, size, color)


func _text_right(value: String, y: float, size: int, color: Color) -> void:
	var font := _font()
	if font == null:
		return
	draw_string(font, Vector2(0.0, y), value, HORIZONTAL_ALIGNMENT_RIGHT, W - 34.0, size, color)


func _text_width(value: String, size: int) -> float:
	var font := _font()
	if font == null:
		return 0.0
	return font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x


func _draw() -> void:
	if _font() == null:
		return

	if mode == "title":
		_draw_title()
		return

	if mode == "play" or mode == "paused" or mode == "clear" or mode == "dead":
		_draw_hud()

	match mode:
		"dead":
			_draw_death()
		"paused":
			_draw_panel("Paused", room_name, ["Deaths this room: %d" % deaths], "P / ENTER resume   ·   R restart room", Color(0.47, 0.78, 1.0, 0.3))
		"clear":
			_draw_panel(panel_title, panel_subtitle, panel_lines, panel_footer, Color(1.0, 0.84, 0.47, 0.5))
		"victory":
			_draw_panel(panel_title, panel_subtitle, panel_lines, panel_footer, Color(0.63, 1.0, 0.78, 0.45))


func _draw_hud() -> void:
	draw_rect(Rect2(0.0, 0.0, W, 118.0), Color(0.02, 0.04, 0.07, 0.22))
	_text("ROOM %d / %d" % [room_index + 1, room_count], Vector2(34.0, 42.0), 13, Color(0.75, 0.84, 0.94, 0.8))
	_text(room_name.to_upper(), Vector2(34.0, 70.0), 24, WHITE)
	if deaths > 0:
		_text("deaths %d" % deaths, Vector2(34.0, 92.0), 13, Color(1.0, 0.71, 0.66, 0.9))
	_text_right("R restart   ·   P pause   ·   M sound", 44.0, 12, Color(1, 1, 1, 0.5))

	if hint_timer > 0.0 and hint != "":
		var alpha := clampf(hint_timer / 0.7, 0.0, 1.0)
		var width := _text_width(hint, 17) + 48.0
		var box := Rect2(W * 0.5 - width * 0.5, 646.0, width, 42.0)
		draw_rect(box, Color(0.03, 0.05, 0.08, 0.78 * alpha))
		draw_rect(box, Color(1, 1, 1, 0.12 * alpha), false, 1.0)
		var font := _font()
		if font != null:
			draw_string(font, Vector2(box.position.x + 24.0, 673.0), hint, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(0.93, 0.96, 1.0, alpha))

	if taunt_timer > 0.0 and taunt != "":
		var alpha := clampf(taunt_timer / 0.4, 0.0, 1.0)
		var width := _text_width(taunt, 26) + 60.0
		var box := Rect2(W * 0.5 - width * 0.5, 132.0, width, 54.0)
		draw_rect(box, Color(0.49, 0.11, 0.14, 0.92 * alpha))
		draw_rect(box, Color(1.0, 0.74, 0.7, 0.45 * alpha), false, 2.0)
		var font := _font()
		if font != null:
			draw_string(font, Vector2(box.position.x + 30.0, 168.0), taunt, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color(1.0, 0.91, 0.89, alpha))


func _draw_death() -> void:
	draw_rect(Rect2(0.0, 0.0, W, H), Color(0.47, 0.08, 0.1, 0.18))
	_text_centered("TRY AGAIN", 336.0, 30, Color(1.0, 0.82, 0.78, 0.95))


func _draw_panel(title: String, subtitle: String, lines: Array, footer: String, accent: Color) -> void:
	draw_rect(Rect2(0.0, 0.0, W, H), Color(0.02, 0.04, 0.06, 0.66))
	var height := 236.0 + float(lines.size()) * 30.0 + (34.0 if subtitle != "" else 0.0)
	var box := Rect2(W * 0.5 - 330.0, H * 0.5 - height * 0.5, 660.0, height)
	draw_rect(box, Color(0.09, 0.12, 0.17, 0.97))
	draw_rect(box, accent, false, 2.0)

	_text_centered(title, box.position.y + 96.0, 44, Color(0.95, 0.97, 1.0))
	var cursor := box.position.y + 140.0
	if subtitle != "":
		_text_centered(subtitle, cursor, 18, Color(0.75, 0.82, 0.9, 0.9))
		cursor += 34.0
	for line in lines:
		_text_centered(str(line), cursor, 17, Color(0.87, 0.92, 0.97, 0.95))
		cursor += 30.0
	if footer != "":
		_text_centered(footer, box.end.y - 34.0, 15, Color(0.59, 0.78, 1.0, 0.95))


func _draw_title() -> void:
	draw_rect(Rect2(0.0, 0.0, W, H), Color(0.02, 0.04, 0.06, 0.42))
	_text_centered("TRAP GAME", 210.0, 92, Color(0.97, 0.99, 1.0))
	_text_centered("EVERY DOOR LIES", 262.0, 22, Color(1.0, 0.87, 0.59, 0.95))
	_text_centered("Ten rooms. One door each. The ruins cheat — expect it.", 302.0, 17, Color(0.89, 0.93, 0.99, 0.82))

	# level pips
	var spacing := 40.0
	var start := W * 0.5 - (float(room_count - 1) * spacing) * 0.5
	for i in room_count:
		var center := Vector2(start + float(i) * spacing, 348.0)
		var is_selected := i == title_pick
		var is_unlocked := i <= unlocked
		var radius := 13.0 if is_selected else 9.0
		var color := Color(1.0, 0.88, 0.48) if is_selected else (Color(0.63, 0.84, 1.0, 0.85) if is_unlocked else Color(1, 1, 1, 0.16))
		draw_circle(center, radius, color)
		if is_selected:
			draw_arc(center, radius + 3.0, 0.0, TAU, 24, Color(1, 1, 1, 0.85), 2.0)

	var line := "Room %d — %s" % [title_pick + 1, room_name]
	if best_deaths >= 0:
		line += "   ·   best %d death%s" % [best_deaths, "" if best_deaths == 1 else "s"]
	_text_centered(line, 386.0, 15, Color(0.82, 0.89, 0.96, 0.8))
	_text_centered("PRESS ENTER TO PLAY", 440.0, 21, Color(1.0, 0.91, 0.66, 0.95))
	_text_centered("← → move   ·   SPACE jump   ·   R restart   ·   P pause   ·   M sound", 486.0, 15, Color(0.75, 0.82, 0.89, 0.72))
