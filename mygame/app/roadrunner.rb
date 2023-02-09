class Roadrunner < Sprite
  def initialize opts
    start_looping_at = 0
    number_of_sprites = 4
    number_of_frames_to_show_each_sprite = 9
    does_sprite_loop = true

    sprite_index =
      start_looping_at.frame_index number_of_sprites,
                                  number_of_frames_to_show_each_sprite,
                                  does_sprite_loop

    @w = 100
    @x = opts[:x] + ((TileBoard::TILE_SIZE - @w) / 2)
    @y = opts[:y] - 3 + (sprite_index * 3)
    @h = TileBoard::TILE_SIZE * 2
    @path = "sprites/roadrunner_#{sprite_index}.png"
    @angle = Common::Direction.angle(opts[:direction])
  end
end