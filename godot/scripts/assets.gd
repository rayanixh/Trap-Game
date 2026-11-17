extends Node
##
## Loads the packed art produced by tools/extract_assets.py and hands out
## AtlasTextures by sprite name, so rooms never touch raw pixel coordinates.
##

const BASE := "res://assets/"

var manifest: Dictionary = {}
var kit_texture: Texture2D
var stone_texture: Texture2D
var ledge_texture: Texture2D
var player_texture: Texture2D

var _sprite_cache: Dictionary = {}
var _frame_cache: Dictionary = {}


func _ready() -> void:
	_load()


func _load() -> void:
	var file := FileAccess.open(BASE + "manifest.json", FileAccess.READ)
	if file == null:
		push_error("assets: manifest.json missing — run tools/extract_assets.py")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("assets: manifest.json is not valid JSON")
		return
	manifest = parsed as Dictionary

	kit_texture = load(BASE + "kit-atlas.png")
	stone_texture = load(BASE + "stone-tile.png")
	ledge_texture = load(BASE + "ledge-tile.png")
	player_texture = load(BASE + "player-atlas.png")


func has_sprite(sprite_name: String) -> bool:
	return manifest.has("sprites") and (manifest["sprites"] as Dictionary).has(sprite_name)


## AtlasTexture for a kit sprite, cached by name.
func sprite(sprite_name: String) -> AtlasTexture:
	if _sprite_cache.has(sprite_name):
		return _sprite_cache[sprite_name]
	var table: Dictionary = manifest["sprites"]
	if not table.has(sprite_name):
		push_error("assets: unknown sprite '%s'" % sprite_name)
		return null
	var entry: Dictionary = table[sprite_name]
	var texture := AtlasTexture.new()
	texture.atlas = kit_texture
	texture.region = Rect2(entry["x"], entry["y"], entry["w"], entry["h"])
	_sprite_cache[sprite_name] = texture
	return texture


func sprite_size(sprite_name: String) -> Vector2:
	var table: Dictionary = manifest["sprites"]
	if not table.has(sprite_name):
		return Vector2.ZERO
	var entry: Dictionary = table[sprite_name]
	return Vector2(entry["w"], entry["h"])


## Sprite2D anchored on its bottom-centre point, scaled to `height` pixels.
func make_sprite(sprite_name: String, height: float) -> Sprite2D:
	var texture := sprite(sprite_name)
	var node := Sprite2D.new()
	node.texture = texture
	if texture == null:
		return node
	var scale_factor := height / float(texture.get_height())
	node.scale = Vector2(scale_factor, scale_factor)
	node.centered = false
	node.offset = Vector2(-texture.get_width() * 0.5, -texture.get_height())
	return node


func player_cell() -> Vector2:
	var info: Dictionary = manifest["player"]
	return Vector2(info["cellWidth"], info["cellHeight"])


## AtlasTexture for one animation frame, cached by "anim:index".
func player_frame(animation: String, frame_index: int) -> AtlasTexture:
	var key := "%s:%d" % [animation, frame_index]
	if _frame_cache.has(key):
		return _frame_cache[key]

	var info: Dictionary = manifest["player"]
	var animations: Dictionary = info["animations"]
	if not animations.has(animation):
		return null
	var frames: Array = animations[animation]
	if frames.is_empty():
		return null
	var cell := player_cell()
	var entry: Array = frames[frame_index % frames.size()]
	var texture := AtlasTexture.new()
	texture.atlas = player_texture
	texture.region = Rect2(
		float(entry[0]) * cell.x,
		float(entry[1]) * cell.y,
		cell.x,
		cell.y
	)
	_frame_cache[key] = texture
	return texture


func animation_length(animation: String) -> int:
	var animations: Dictionary = (manifest["player"] as Dictionary)["animations"]
	if not animations.has(animation):
		return 0
	return (animations[animation] as Array).size()
