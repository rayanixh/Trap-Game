extends Node
##
## Checks that the menus respond to the keyboard, the mouse and touches.
##
##   godot --headless --path godot tests/input_test.tscn
##

var main
var failures := 0


func report(ok: bool, label: String) -> void:
	print("ok    " if ok else "FAIL  ", label)
	if not ok:
		failures += 1


func press_key(key: int) -> void:
	for state in [true, false]:
		var event := InputEventKey.new()
		event.physical_keycode = key
		event.keycode = key
		event.pressed = state
		Input.parse_input_event(event)


func click() -> void:
	for state in [true, false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = state
		event.position = Vector2(640.0, 440.0)
		Input.parse_input_event(event)


func tap() -> void:
	for state in [true, false]:
		var event := InputEventScreenTouch.new()
		event.index = 0
		event.pressed = state
		event.position = Vector2(640.0, 440.0)
		Input.parse_input_event(event)


func settle() -> void:
	await get_tree().process_frame
	await get_tree().process_frame


func _ready() -> void:
	await settle()
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await settle()
	await get_tree().physics_frame

	report(InputMap.has_action("confirm") and InputMap.has_action("jump"), "input actions registered")
	report(main.hud.mouse_filter == Control.MOUSE_FILTER_IGNORE, "HUD lets clicks through")
	report(main.state == main.State.TITLE, "starts on the title screen")

	press_key(KEY_ENTER)
	await settle()
	report(main.state == main.State.PLAY, "ENTER starts the game")

	main._to_title()
	await settle()
	press_key(KEY_SPACE)
	await settle()
	report(main.state == main.State.PLAY, "SPACE starts the game")

	main._to_title()
	await settle()
	press_key(KEY_J)
	await settle()
	report(main.state == main.State.PLAY, "any other key starts the game")

	main._to_title()
	await settle()
	click()
	await settle()
	report(main.state == main.State.PLAY, "clicking the title screen starts the game")

	main._to_title()
	await settle()
	tap()
	await settle()
	report(main.state == main.State.PLAY, "tapping the title screen starts the game")

	# menu panels
	main._start_room(0)
	await settle()
	main._clear_room()
	await settle()
	report(main.state == main.State.CLEAR, "clearing shows the clear panel")
	click()
	await settle()
	report(main.state == main.State.PLAY and main.room_index == 1, "clicking continues to the next room")

	main._die()
	await settle()
	report(main.state == main.State.DEAD, "dying shows the retry panel")
	click()
	await settle()
	report(main.state == main.State.PLAY, "clicking retries the room")

	main._set_state(main.State.PAUSED)
	await settle()
	press_key(KEY_P)
	await settle()
	report(main.state == main.State.PLAY, "P resumes from pause")

	# on-screen pad
	var buttons: Array = main.controls.get_children()
	report(buttons.size() == 3, "three on-screen buttons")
	var on_screen := true
	for button in buttons:
		if button.position.x < 0.0 or button.position.y < 0.0:
			on_screen = false
		if button.position.x + button.size.x > 1280.0 or button.position.y + button.size.y > 720.0:
			on_screen = false
	report(on_screen, "buttons sit inside the screen")

	main._start_room(0)
	await settle()
	var start_x: float = main.player.position.x
	buttons[1].button_down.emit()
	for frame in 24:
		await get_tree().physics_frame
	buttons[1].button_up.emit()
	report(main.player.position.x > start_x + 20.0, "right button moves the player")

	main._start_room(0)
	await settle()
	var ground_y: float = main.player.position.y
	buttons[2].button_down.emit()
	for frame in 10:
		await get_tree().physics_frame
	buttons[2].button_up.emit()
	report(main.player.position.y < ground_y - 10.0, "jump button jumps")

	main._start_room(0)
	await settle()
	var walk_x: float = main.player.position.x
	buttons[0].button_down.emit()
	for frame in 20:
		await get_tree().physics_frame
	buttons[0].button_up.emit()
	report(main.player.position.x <= walk_x + 0.5, "left button does not walk right")

	print("---")
	print("%d failed" % failures)
	get_tree().quit(0 if failures == 0 else 1)
