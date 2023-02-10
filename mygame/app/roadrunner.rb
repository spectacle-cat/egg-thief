class Roadrunner < Sprite
  def initialize opts
    @opts = opts
    start_looping_at = 0
    number_of_sprites = 4
    number_of_frames_to_show_each_sprite = 9
    does_sprite_loop = true

    sprite_index =
      start_looping_at.frame_index number_of_sprites,
                                  number_of_frames_to_show_each_sprite,
                                  does_sprite_loop
    @x = calculate_x(opts, width: @w, sprite_index: sprite_index)
    @y = calculate_y(opts, sprite_index: sprite_index)
    @path = "sprites/roadrunner_#{sprite_index}.png"
    @h = TileBoard::TILE_SIZE * 2
    @w = TileBoard::TILE_SIZE

    @angle = opts[:angle] || 0
    @angle_anchor_x = 0.5
    @angle_anchor_y = 0.5
  end

  def calculate_x(opts, width: , sprite_index:)
    opts[:x] # - 3 + ((TileBoard::TILE_SIZE - width) / 2) + (sprite_index * 3)
    opts[:x] - (TileBoard::TILE_SIZE / 2)
  end

  def calculate_y(opts, sprite_index: )
    y = opts[:y] # - 3 + (sprite_index * 3)
    opts[:y] - (TileBoard::TILE_SIZE)

    # if opts[:direction] == :left || opts[:direction] == :right || opts[:corner]
    #   y -= TileBoard::TILE_SIZE / 2
    # end
  end
end