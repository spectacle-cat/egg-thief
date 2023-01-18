module TileBoard
  extend self

  ROWS = 7
  COLUMNS = 12

  def setup(args, level:)
    args.state.level = level
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

    load_level(args, level)
    build_tiles(args)
  end

  def load_level(args, level)
    data = args.gtk.read_file("data/levels/level_#{level}.txt")
    rows = data.split

    args.state.level_data = rows.map { |row| row.chars }
  end

  def build_tiles(args)
    args.state.board[:tiles] = []
    index_counter = 0

    0.upto(args.state.board[:rows] - 1).each do |row|
      0.upto(args.state.board[:columns] - 1).each do |col|
        index_counter += 1

        y = (row * 100) + 10
        x = (col * 100) + 40

        tile_type = args.state.level_data[row][col]
        puts tile_type
        next if tile_type == 'X'

        args.state.tiles << {
          type: :floor,
          column: col,
          row: row,
          index: index_counter,
          y: y,
          x: x,
        }

        if tile_type == 'C'
          args.state.cover << { x: x, y: y, index: [1, 2, 3].sample }
        end

        if tile_type == 'E'
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
      shrub_sprite(x: cover[:x], y: cover[:y], index: cover[:index])
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

  def shrub_sprite(x:, y: , index: [1, 2, 3].sample)
    expand_by = 50

    {
      x: x - (expand_by / 2),
      y: y - (expand_by / 2),
      w: 100 + expand_by,
      h: 100 + expand_by,
      path: "sprites/tuft_#{index}.png",
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