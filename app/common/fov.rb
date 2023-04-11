class Fov
  attr_reader :fov_tiles, :target_tiles

  def initialize(fov_tiles:, facing: :up, base_width: 3)
    @fov_tiles = fov_tiles
    @target_tiles = base_tiles(facing, base_width)
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

      if connecting_tile && hits_base?(i, row)
        break
      elsif connecting_tile
        i = i - i.sign
      else
        break
      end
    end

    hits_base?(i, row)
  end

  def check_row(col:, row:)
    i = row

    while i != 0
      connecting_tile = fov_tiles.find { |tile| tile[:fov_col] == col && tile[:fov_row] == i }

      if connecting_tile && hits_base?(col, i)
        break
      elsif connecting_tile
        i = i - i.sign
      else
        break
      end
    end

    hits_base?(col, i)
  end

  private

  def hits_base?(col, row)
    # [0, 0] == [col, row]
    target_tiles.include?([col, row])
  end

  def base_tiles(facing, width)
    either_side = width > 0 ? (width - 1) / 2 : 0

    if facing == :up || facing == :down
      [[-1, 0], [0, 0], [1, 0]]
    elsif facing == :right || facing == :left
      [[0, -1], [0, 0], [0, 1]]
    end
  end
end