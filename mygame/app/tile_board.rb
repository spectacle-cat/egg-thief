module TileBoard
  extend self

  ROWS = 7
  ROW_GUTTER = 10
  COLUMNS = 12
  COLUMN_GUTTER = 20
  TILE_SIZE = 100

  def setup(args)
    args.state.board ||= {
      rows: ROWS,
      columns: COLUMNS,
      tile_size: TILE_SIZE,
      column_gutter: COLUMN_GUTTER,
      row_gutter: ROW_GUTTER,
    }
    args.state.tiles ||= []
    args.state.empty_tiles ||= []
    args.state.nests ||= []
    args.state.cover ||= []

    build_tiles(args)
  end

  def reset(args)
    args.state.board = nil
    args.state.tiles = []
    args.state.empty_tiles = []
    args.state.nests = []
    args.state.cover = []
  end

  def build_tiles(args)
    args.state.board[:tiles] = []
    index_counter = 0

    0.upto(args.state.board[:rows] - 1).each do |row|
      0.upto(args.state.board[:columns] - 1).each do |col|
        index_counter += 1

        y = (row * 100) + 10
        x = (col * 100) + 40

        tile_data = args.state.level_data[row][col]

        tile = {
          type: tile_data == 'X' ? :empty : :floor,
          column: col,
          row: row,
          index: index_counter,
          y: y,
          x: x,
          w: TILE_SIZE,
          h: TILE_SIZE
        }

        if tile_data == 'X'
          args.state.empty_tiles << tile
        else
          args.state.tiles << tile
        end

        if tile_data == 'C'
          args.state.cover << { x: x, y: y, index: [1, 2, 3].sample }
        end

        if tile_data == 'E'
          args.state.nests << {
            x: x, y: y,
            collision_box: { x: x + 25, y: y + 25, w: 25, h: 25 }
          }
        end

        if tile_data == 'S'
          args.state.player.start_point.x = x
          args.state.player.start_point.y = y
          puts "start!"
        end

        if tile_data == 'F'
          args.state.player.finish_point.x = x
          args.state.player.finish_point.y = y
          puts "finish!"
        end
      end
    end
  end

  def can_walk_to(args, x:, y:)
    target_player_rect = {
      x: x,
      y: y,
      w: args.state.player.w,
      h: args.state.player.h,
    }
    args.state.player_collider = player_collider = {
      w: 50,
      h: 50,
    }.center_inside_rect(target_player_rect)

    !args.state.empty_tiles.any_intersect_rect?(player_collider) and !outside_of_board?(args, player_collider)
  end

  def outside_of_board?(args, player_collider)
    if player_collider.x > (1280 - 90)
      true
    elsif player_collider.x < 35
      true
    elsif player_collider.y > (720 - 60)
      true
    elsif player_collider.y < 10
      true
    else
      false
    end
  end

  def render_tiles(args)
    args.outputs.sprites << args.state.tiles.map do |tile|
      tile_sprite(x: tile[:x], y: tile[:y])
    end

  end

  def render_finish(args)
    fp = args.state.player.finish_point
    args.state.interactables.finish_rect = finish_border =
      [fp.x, fp.y, TILE_SIZE, TILE_SIZE, 255, 255, 255, 150 ]
    args.outputs.primitives << finish_border.solid
    args.outputs.labels << [fp.x + 30, fp.y + 20, "EXIT"]
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