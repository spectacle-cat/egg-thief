class Roadrunner < Sprite
  attr_accessor :origin_point, :x, :y

  def initialize(origin_point:, angle: 0)
    self.origin_point = origin_point
    start_looping_at = 0
    number_of_sprites = 4
    number_of_frames_to_show_each_sprite = 9
    does_sprite_loop = true

    sprite_index =
      start_looping_at.frame_index number_of_sprites,
                                  number_of_frames_to_show_each_sprite,
                                  does_sprite_loop
    @h = TileBoard::TILE_SIZE * 2
    @w = TileBoard::TILE_SIZE
    @path = "sprites/roadrunner_#{sprite_index}.png"

    @angle = angle
    @angle_anchor_x = 0.5
    @angle_anchor_y = 0.5
  end

  def origin_point=(point)
    @origin_point = point
  end

  def x
    origin_point.x - (TileBoard::TILE_SIZE / 2)
  end

  def y
    origin_point.y - (TileBoard::TILE_SIZE)
  end
end