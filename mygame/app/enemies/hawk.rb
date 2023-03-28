module Enemies
  class Hawk < Sprite
    attr_accessor :origin_point, :x, :y

    def initialize(origin_point:, angle: 0)
      self.origin_point = origin_point

      @h = TileBoard::TILE_SIZE * 2
      @w = TileBoard::TILE_SIZE * 3
      @path = "sprites/hawk_centre.png"
      @angle = angle
    end

    def origin_point=(point)
      @origin_point = point
    end

    def x
      origin_point.x - (TileBoard::TILE_SIZE)
    end

    def y
      origin_point.y - (TileBoard::TILE_SIZE / 2)
    end

    def fov
      quarter = (angle / 90).round

      case quarter % 4
      when 0 || 4
        <<~FOV
        xxx
        xxx
         ^
        FOV

        [
          [:info, :up],
          [-1, 2], [0, 2], [1, 2],
          [-1, 1], [0, 1], [1, 1],
                   [0, 0],
        ]
      when 3
        <<~FOV
         xx
        ^xx
         xx
        FOV

        [
          [:info, :right],
                   [1,  1], [2,  1],
          [0,  0], [1,  0], [2,  0],
                   [1, -1], [2, -1],
        ]
      when 2
        <<~FOV
         ^
        xxx
        xxx
        FOV

        [
          [:info, :down],
                    [0,  0],
          [-1, -1], [0, -1], [1, -1],
          [-1, -2], [0, -2], [1, -2],
        ]
      when 1
        <<~FOV
        xx
        xx^
        xx
        FOV

        [
          [:info, :left],
          [-2,  1], [-1,  1],
          [-2,  0], [-1,  0], [0,  0],
          [-2, -1], [-1, -1],
        ]
      else
        raise "missing: #{quarter % 4}"
      end
    end
  end
end