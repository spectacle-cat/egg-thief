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

  def fov
    quarter = (angle / 90).round

    case quarter % 4
    when 0 || 4
      <<~FOV
      xxx
      xxx
      x^x
      FOV

      [
        [:info, :up],
                 [0, 4],
        [-1, 3], [0, 3], [1, 3],
        [-1, 2], [0, 2], [1, 2],
        [-1, 1], [0, 1], [1, 1],
                 [0, 0],
      ]
    when 3
      <<~FOV
      xxx
      ^xx
      xxx
      FOV

      [
        [:info, :right],
                 [1,  1], [2,  1], [3,  1],
        [0,  0], [1,  0], [2,  0], [3,  0], [4, 0],
                 [1, -1], [2, -1], [3, -1]
      ]
    when 2
      <<~FOV
      x^x
      xxx
      xxx
      FOV

      [
        [:info, :down],
                  [0,  0],
        [-1, -1], [0, -1], [1, -1],
        [-1, -2], [0, -2], [1, -2],
        [-1, -3], [0, -3], [1, -3],
                  [0, -4]
      ]
    when 1
      <<~FOV
      xxx
      xx^
      xxx
      FOV

      [
        [:info, :left],
                 [-3,   1], [-2,  1], [-1,  1],
        [-4, 0], [-3,   0], [-2,  0], [-1,  0], [0,  0],
                 [-3,  -1], [-2, -1], [-1, -1],
      ]
    else
      raise "missing: #{quarter % 4}"
    end
  end
end