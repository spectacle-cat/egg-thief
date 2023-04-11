class Scoring
  class BackgroundSprite < Sprite
    WIDTH = 149 / 2

    def initialize(opts={})
      @path = "sprites/side_bar.png"
      @w = WIDTH
      @h = (1441 / 2) - (TileBoard::ROW_GUTTER * 2)
      @x = (1270 - @w) + (TileBoard::COLUMN_GUTTER * 2) - 1
      @y = TileBoard::ROW_GUTTER
    end
  end
end