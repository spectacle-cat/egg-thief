module Enemies
  class Owl < Sprite
    attr_accessor :origin_point, :x, :y

    def initialize(origin_point:, angle: 0)
      self.origin_point = origin_point

      @h = TileBoard::TILE_SIZE
      @w = TileBoard::TILE_SIZE * 2
      @path = "sprites/owl_centre.png"
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
        x^x
        FOV

        [
          [:info, :up],
          [-1, 1], [0, 1], [1, 1],
          [0, -1], [0, 0], [0, 1]
        ]
      when 3
        <<~FOV
        xx
        ^x
        xx
        FOV

        [
          [:info, :right],
          [0,  1], [1,  1],
          [0,  0], [1,  0],
          [0, -1], [1, -1],
        ]
      when 2
        <<~FOV
        x^x
        xxx
        FOV

        [
          [:info, :down],
          [-1,  0], [0,  0], [1, 0],
          [-1, -1], [0, -1], [1, -1],
        ]
      when 1
        <<~FOV
        xx
        x^
        xx
        FOV

        [
          [:info, :left],
          [-1,  1], [0,  1],
          [-1,  0], [0,  0],
          [-1, -1], [0, -1]
        ]
      else
        raise "missing: #{quarter % 4}"
      end
    end
  end
end