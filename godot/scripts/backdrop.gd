extends Node2D
##
## Static backdrop for a single-screen room: sky gradient, cloud banks, distant
## ruins and hills, all drawn with layered alpha so the playfield stays readable.
##

const W := 1280.0
const H := 720.0
const HORIZON := 508.0

var _sky: GradientTexture2D
var _ruins: Array = []
var _hills: Array = []
var _clouds: Array = []


func _ready() -> void:
	z_index = -10

	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	gradient.colors = PackedColorArray([
		Color("#8fd0ee"),
		Color("#bfe6f7"),
		Color("#e9f6fb"),
	])
	_sky = GradientTexture2D.new()
	_sky.gradient = gradient
	_sky.fill_from = Vector2(0.0, 0.0)
	_sky.fill_to = Vector2(0.0, 1.0)
	_sky.width = 16
	_sky.height = 256

	var rng := RandomNumberGenerator.new()
	rng.seed = 20261117

	for i in 22:
		_ruins.append({
			"x": float(i) * 260.0 + rng.randf_range(0.0, 90.0),
			"w": rng.randf_range(90.0, 240.0),
			"h": rng.randf_range(120.0, 330.0),
		})
	for i in 18:
		_hills.append({
			"x": float(i) * 420.0 + rng.randf_range(0.0, 120.0),
			"w": rng.randf_range(420.0, 620.0),
			"h": rng.randf_range(80.0, 190.0),
		})
	for i in 14:
		_clouds.append({
			"x": rng.randf_range(-100.0, 1380.0),
			"y": rng.randf_range(50.0, 220.0),
			"s": rng.randf_range(0.6, 1.4),
		})

	queue_redraw()


func _draw() -> void:
	if _sky != null:
		draw_texture_rect(_sky, Rect2(0.0, 0.0, W, H), false)

	# sun bloom
	for i in range(7, 0, -1):
		draw_circle(Vector2(1060.0, 130.0), 52.0 * float(i), Color(1.0, 0.97, 0.85, 0.016 * float(i)))

	for cloud in _clouds:
		_cloud(Vector2(cloud["x"], cloud["y"]), float(cloud["s"]))

	for hill in _hills:
		var base_y := HORIZON + 10.0
		var points := PackedVector2Array()
		var segments := 16
		for s in segments + 1:
			var t := float(s) / float(segments)
			var x: float = hill["x"] + t * float(hill["w"])
			var y: float = base_y - sin(t * PI) * float(hill["h"])
			points.append(Vector2(x, y))
		points.append(Vector2(float(hill["x"]) + float(hill["w"]), base_y + 40.0))
		points.append(Vector2(hill["x"], base_y + 40.0))
		draw_colored_polygon(points, Color(0.49, 0.67, 0.56, 0.42))

	for ruin in _ruins:
		_ruin(ruin)

	# haze along the horizon so the floor line reads clearly
	var haze := Rect2(0.0, HORIZON - 46.0, W, 70.0)
	draw_rect(haze, Color(0.91, 0.96, 0.98, 0.35))


func _cloud(center: Vector2, scale_factor: float) -> void:
	var puffs := [
		Vector2(0.0, 0.0),
		Vector2(30.0, -12.0),
		Vector2(66.0, 2.0),
		Vector2(-28.0, 6.0),
		Vector2(40.0, 14.0),
	]
	var radii := [34.0, 42.0, 30.0, 24.0, 26.0]
	for i in puffs.size():
		var offset: Vector2 = puffs[i] * scale_factor
		draw_circle(center + offset, float(radii[i]) * scale_factor, Color(1.0, 1.0, 1.0, 0.55))


func _ruin(ruin: Dictionary) -> void:
	var x := float(ruin["x"])
	var w := float(ruin["w"])
	var h := float(ruin["h"])
	var base_y := HORIZON + 12.0

	draw_rect(Rect2(x, base_y - h, w, h), Color(0.64, 0.76, 0.82, 0.55))
	# parapet
	draw_rect(Rect2(x - 6.0, base_y - h - 10.0, w + 12.0, 12.0), Color(0.55, 0.67, 0.75, 0.6))
	for m in 3:
		draw_rect(Rect2(x + w * (0.1 + 0.3 * float(m)), base_y - h - 22.0, w * 0.14, 12.0), Color(0.55, 0.67, 0.75, 0.6))
	# window slots
	draw_rect(Rect2(x + w * 0.68, base_y - h * 0.86, w * 0.14, h * 0.3), Color(1.0, 1.0, 1.0, 0.2))
	draw_rect(Rect2(x + w * 0.2, base_y - h * 0.58, w * 0.12, h * 0.24), Color(1.0, 1.0, 1.0, 0.16))
	# shadowed base
	draw_rect(Rect2(x, base_y - h * 0.2, w, h * 0.2), Color(0.59, 0.72, 0.78, 0.3))
