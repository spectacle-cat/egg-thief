module TileBoard
  extend self

  ROWS = 7
  COLUMNS = 12

  def tick(args)
    args.state.board ||= {
      rows: ROWS,
      columns: COLUMNS,
      tile_size: 100,
      column_gutter: 20,
      row_gutter: 10,
      tiles: nil
    }

    if args.state.board[:tiles].nil?
      build_tiles(args)
    end

    render_tiles(args)
  end

  def build_tiles(args)
    args.state.board[:tiles] = []
    index_counter = 0

    0.upto(args.state.board[:rows] - 1).each do |row|
      0.upto(args.state.board[:columns] - 1).each do |col|
        args.state.board[:tiles][index_counter] = {
          type: :floor,
          column: col,
          row: row,
          index: index_counter
        }
        index_counter += 1
      end
    end
  end

  def render_tiles(args)
    tiles = []

    args.state.board[:tiles].each do |tile|
      if tile[:type] == :floor
        y = (tile[:row] * 100) + 10
        x = (tile[:column] * 100) + 40

        tiles << tile_sprite(x: x, y: y)
      end
    end

    args.outputs.sprites << tiles
  end

  def tile_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 100,
      h: 100,
      path: "sprites/tile_floor.png",
    }
  end
end