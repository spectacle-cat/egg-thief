class Scoring
  class BackgroundSprite < Sprite
    WIDTH = 148 / 2
    def initialize(opts={})
      @path = "sprites/side_bar.png"
      @w = WIDTH
      @h = (1440 / 2) - (TileBoard::ROW_GUTTER * 2)
      @x = (1270 - @w) + (TileBoard::COLUMN_GUTTER * 2) - 1
      @y = TileBoard::ROW_GUTTER
    end
  end
end