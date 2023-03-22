class Scoring
  class EggCounter < Sprite
    def initialize(opts={}, index: 1, enabled: false)
      egg_index = index
      egg_index = 1 if index == 4

      @path = if enabled
        "sprites/EGG_count_#{egg_index}.png"
      else
        "sprites/EGG_count_shade_#{egg_index}.png"
      end

      @w = 149 / 2
      @h = 110 / 2

      @x = 1270 - Scoring::BackgroundSprite::WIDTH + (TileBoard::COLUMN_GUTTER * 2) + 2

      voffset = @h * (index - 1)
      @y = 720 - @h - TileBoard::ROW_GUTTER - voffset
    end
  end
end