extends StaticBody2D
##
## A solid platform: one rectangle of stone body with a continuous grass top.
## Carving it (collapsing floors) splits it into up to two smaller platforms.
##

var rect_size := Vector2.ZERO
var _stones: Texture2D
var _ledge: Texture2D


func setup(size_px: Vector2) -> void:
	rect_size = size_px
	_stones = Assets.stone_texture
	_ledge = Assets.ledge_texture

	var shape := CollisionShape2D.new()
	var box := RectangleShape2D.new()
	box.size = rect_size
	shape.shape = box
	shape.position = rect_size * 0.5
	add_child(shape)
	queue_redraw()


func _draw() -> void:
	if _stones != null:
		draw_texture_rect(_stones, Rect2(Vector2.ZERO, rect_size), true)
	if _ledge != null:
		var ledge_width := float(_ledge.get_width())
		var x := 0.0
		while x < rect_size.x:
			draw_texture(_ledge, Vector2(x, 0.0))
			x += ledge_width
	# faint highlight where the player stands
	draw_rect(Rect2(0.0, 0.0, rect_size.x, 2.0), Color(1.0, 1.0, 1.0, 0.12))
	# depth towards the bottom of the block
	draw_rect(Rect2(0.0, rect_size.y - 26.0, rect_size.x, 26.0), Color(0.02, 0.04, 0.07, 0.35))


## Remove a horizontal span from this platform.
## Returns the Rect2 spans that should replace it (global coordinates).
func carve(global_x: float, width: float) -> Array:
	var left := global_position.x
	var right := global_position.x + rect_size.x
	var cut_start := maxf(global_x, left)
	var cut_end := minf(global_x + width, right)

	if cut_end <= cut_start:
		return [Rect2(global_position, rect_size)]

	var leftovers: Array = []
	if cut_start > left:
		leftovers.append(Rect2(Vector2(left, global_position.y), Vector2(cut_start - left, rect_size.y)))
	if cut_end < right:
		leftovers.append(Rect2(Vector2(cut_end, global_position.y), Vector2(right - cut_end, rect_size.y)))

	queue_free()
	return leftovers
