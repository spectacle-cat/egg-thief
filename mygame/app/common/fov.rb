class Fov
  attr_reader :fov_tiles

  def initialize(fov_tiles:)
    @fov_tiles = fov_tiles
  end

  def in_sight?(fov_col:, fov_row:)
    in_sight = fov_col == 0 && fov_row == 0

    in_sight = check_col(col: fov_col, row: fov_row) unless in_sight
    in_sight = check_row(col: fov_col, row: fov_row) unless in_sight

    in_sight
  end

  def check_col(col:, row:)
    i = col

    while i != 0
      connecting_tile = fov_tiles.find { |tile| tile[:fov_col] == i && tile[:fov_row] == row }

      if connecting_tile
        i = i - i.sign
      else
        break
      end
    end

    i == 0 && row == 0
  end

  def check_row(col:, row:)
    i = row

    while i != 0
      connecting_tile = fov_tiles.find { |tile| tile[:fov_col] == col && tile[:fov_row] == i }

      if connecting_tile
        i = i - i.sign
      else
        break
      end
    end

    insight = col == 0 && i == 0
  end
end