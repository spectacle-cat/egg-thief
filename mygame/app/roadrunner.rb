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
    @x = calculate_x(opts, width: @w, sprite_index: sprite_index)
    @y = calculate_y(opts, sprite_index: sprite_index)
    @h = TileBoard::TILE_SIZE * 2
    @path = "sprites/roadrunner_#{sprite_index}.png"
    @angle = opts[:angle]
  end

  def calculate_x(opts, width: , sprite_index:)
    opts[:x] - 3 + ((TileBoard::TILE_SIZE - width) / 2) + (sprite_index * 3)
  end

  def calculate_y(opts, sprite_index: )
    y = opts[:y] - 3 + (sprite_index * 3)

    if opts[:direction] == :left || opts[:direction] == :right
      y -= TileBoard::TILE_SIZE / 2
    end

    y
  end
end