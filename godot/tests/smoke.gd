extends Node
##
## Headless gameplay smoke test.
##
##   godot --headless --path godot tests/smoke.tscn
##
## Exits with code 0 when every check passes, 1 otherwise, so the same command
## works in CI as well as locally.
##

const RoomsData := preload("res://scripts/rooms.gd")

var main
var failures: Array = []
var checks := 0


func check(ok: bool, label: String) -> void:
	checks += 1
	if ok:
		print("ok    ", label)
	else:
		failures.append(label)
		print("FAIL  ", label)


func _ready() -> void:
	await get_tree().process_frame
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await get_tree().process_frame
	await get_tree().physics_frame

	_check_assets()
	_check_room_data()
	await _check_every_trap()
	await _check_death_and_retry()
	await _check_door_clear()

	print("---")
	print("%d checks, %d failed" % [checks, failures.size()])
	get_tree().quit(0 if failures.is_empty() else 1)


func _check_assets() -> void:
	check(Assets.manifest.size() > 0, "manifest.json loaded")
	check(Assets.kit_texture != null and Assets.player_texture != null, "atlases loaded")
	check(Assets.stone_texture != null and Assets.ledge_texture != null, "tiles loaded")
	check(Assets.player_frame("run", 3) != null, "player run frames available")
	check(Assets.animation_length("idle") == 4 and Assets.animation_length("jump") == 8, "player animation layout")
	check(Assets.sprite("door") != null and Assets.sprite("spikes-long") != null, "kit sprites resolve")
	check(Assets.sprite_size("door").y > 0.0, "kit sprite sizes readable")

	# anchor maths: sprites sit on their bottom-centre point
	var probe := Assets.make_sprite("door", 190.0)
	check(is_equal_approx(probe.offset.y, -float(Assets.sprite("door").get_height())), "sprite anchored at its feet")
	check(probe.offset.x < 0.0, "sprite centred horizontally")
	check(is_equal_approx(Assets.sprite_size("door").y * probe.scale.y, 190.0), "sprite scaled to requested height")

	for sound_name in ["jump", "land", "hit", "die", "clear", "click", "deny"]:
		check(ResourceLoader.exists("res://assets/audio/%s.wav" % sound_name), "sound %s imported" % sound_name)


func _check_room_data() -> void:
	check(RoomsData.ROOMS.size() == 10, "ten rooms defined")
	var seen := {}
	for room in RoomsData.ROOMS:
		seen[room["id"]] = true
		check((room["platforms"] as Array).size() > 0, "%s has a floor" % room["id"])
		check((room["traps"] as Array).size() > 0, "%s has traps" % room["id"])
		check(room.has("door") and room["door"].has("x"), "%s has a door" % room["id"])
	check(seen.size() == 10, "room ids are unique")


func _check_every_trap() -> void:
	var damaging_kinds := ["spikesDrop", "spikesPop", "crusher", "saw"]

	for room_index in main.ROOMS.size():
		var room: Dictionary = main.ROOMS[room_index]
		main._build_room(room_index)
		check(main.traps.size() == (room["traps"] as Array).size(), "%s traps spawned" % room["id"])

		for trap in main.traps:
			trap.reset()
			var fired := false
			var hazard_seen := Rect2()
			for step in 420:
				trap.tick(1.0 / 60.0, 5000.0)
				if trap.phase != 0:
					fired = true
				var hazard: Rect2 = trap.hazard_rect()
				if hazard.size != Vector2.ZERO:
					hazard_seen = hazard
				if trap.phase == 5:  # DONE
					break
			check(fired, "%s/%s fires" % [room["id"], trap.kind_of()])
			if trap.kind_of() in damaging_kinds:
				check(hazard_seen.size != Vector2.ZERO, "%s/%s deals damage" % [room["id"], trap.kind_of()])


func _check_death_and_retry() -> void:
	main._start_room(0)
	await get_tree().physics_frame

	check(main.state == main.State.PLAY, "room 1 starts in play")
	check(absf(main.player.position.y - 600.0) < 1.5, "player starts on the floor")

	var before: int = main.platforms.size()
	main.player.position = Vector2(640.0, 600.0)
	main.player.velocity = Vector2.ZERO

	var died := false
	for frame in 240:
		await get_tree().physics_frame
		if main.state == main.State.DEAD:
			died = true
			break

	check(died, "falling through the collapsing floor kills the player")
	check(main.platforms.size() != before, "collapsing floor carves the platform")
	check(main.deaths == 1, "death counted")

	for frame in 120:
		await get_tree().physics_frame
		if main.state == main.State.PLAY:
			break

	check(main.state == main.State.PLAY, "room auto-retries after death")
	check(main.deaths == 1, "retry keeps the death count")
	check(absf(main.player.position.x - float(main.room["spawn"])) < 1.0, "retry respawns at the start")


func _check_door_clear() -> void:
	main._start_room(0)
	await get_tree().physics_frame
	main.player.position = Vector2(main.door_x, 600.0)
	main.player.velocity = Vector2.ZERO

	for frame in 10:
		await get_tree().physics_frame
		if main.state == main.State.CLEAR:
			break

	check(main.state == main.State.CLEAR, "reaching the door clears the room")
	check(main.unlocked >= 1, "clearing unlocks the next room")
	check(int(main.best.get("room-1", -1)) >= 0, "best death count recorded")
