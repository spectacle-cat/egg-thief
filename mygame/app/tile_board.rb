module TileBoard
  extend self

  ROWS = 7
  COLUMNS = 12

  def setup(args)
    args.state.board ||= {
      rows: ROWS,
      columns: COLUMNS,
      tile_size: 100,
      column_gutter: 20,
      row_gutter: 10,
    }
    args.state.tiles ||= []
    args.state.nests ||= []
    args.state.cover ||= []

    build_tiles(args)
  end

  def build_tiles(args)
    args.state.board[:tiles] = []
    index_counter = 0

    0.upto(args.state.board[:rows] - 1).each do |row|
      0.upto(args.state.board[:columns] - 1).each do |col|
        index_counter += 1

        y = (row * 100) + 10
        x = (col * 100) + 40

        args.state.tiles << {
          type: :floor,
          column: col,
          row: row,
          index: index_counter,
          y: y,
          x: x,
        }

        if index_counter % 5 == 0
          args.state.cover << { x: x, y: y }
        end

        if index_counter % 8 == 0 &&
          args.state.nests << { x: x, y: y }
        end
      end
    end
  end

  def render_tiles(args)
    args.outputs.sprites << args.state.tiles.map do |tile|
      tile_sprite(x: tile[:x], y: tile[:y])
    end
  end

  def render_cover(args)
    args.outputs.sprites << args.state.cover.map do |cover|
      shrub_sprite(x: cover[:x], y: cover[:y])
    end
  end

  def render_nests(args)
    args.outputs.sprites << args.state.nests.map do |nest|
      nest_sprite(x: nest[:x], y: nest[:y])
    end
  end

  def tile_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 98,
      h: 98,
      path: "sprites/floortile_large.png",
    }
  end

  def shrub_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 98,
      h: 98,
      path: "sprites/tufft2.png",
    }
  end

  def nest_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 98,
      h: 98,
      path: "sprites/nest.png",
    }
  end
end