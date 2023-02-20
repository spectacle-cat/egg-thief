class Scoring
  class EggCounter < Sprite
    def initialize(opts={}, index: 1, enabled: false)
      @path = "sprites/egg_counter.png"
      @w = 74
      @h = 100

      @x = 1270 - Scoring::BackgroundSprite::WIDTH + (TileBoard::COLUMN_GUTTER * 2) + 2

      voffset = @h * (index - 1)
      @y = 720 - @h - TileBoard::ROW_GUTTER - voffset

      @source_x = enabled ? @w : 0
      @source_y = @h * (index - 1)
      @source_h = @h
      @source_w = @w
    end
  end
end