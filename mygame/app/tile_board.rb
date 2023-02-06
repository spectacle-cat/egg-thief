require 'app/scorpion.rb'

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
    args.state.empty_nests ||= []
    args.state.nests ||= []
    args.state.cover ||= []
    args.state.boulders ||= []
    args.state.scorpions ||= []

    build_tiles(args)
  end

  def reset(args)
    args.state.board = nil
    args.state.tiles = []
    args.state.empty_tiles = []
    args.state.empty_nests = []
    args.state.boulders = []
    args.state.scorpions = []
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
          type: :floor,
          column: col,
          row: row,
          index: index_counter,
          y: y,
          x: x,
          w: TILE_SIZE,
          h: TILE_SIZE
        }

        args.state.tiles << tile

        if tile_data == 'C'
          args.state.cover << { x: x, y: y, index: [1, 2, 3].sample }
        end

        if tile_data == 'B' || tile_data == 'b'
          args.state.boulders << { x: x, y: y, w: 100, h: 100 }
        end

        if tile_data == 'b'
          args.state.scorpions << { x: x, y: y, w: 100, h: 100 }
        end

        if tile_data == 'E'
          args.state.nests << {
            x: x, y: y,
            collision_box: { x: x + 25, y: y + 25, w: 25, h: 25 }
          }
          args.state.total_nests += 1
        end

        if tile_data == 'S'
          args.state.player.start_point.x = x
          args.state.player.start_point.y = y
        end

        if tile_data == 'F'
          args.state.player.finish_point.x = x
          args.state.player.finish_point.y = y
        end
      end
    end
  end

  def can_walk_to(args, x:, y:)
    player_collider = Player.player_collision_box(args, x: x, y: y)

    !args.state.boulders.any_intersect_rect?(player_collider) and !outside_of_board?(args, player_collider)
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

  def render_obstacles(args)
    sprites = []

    sprites << args.state.cover.map do |cover|
      shrub_sprite(x: cover[:x], y: cover[:y], index: cover[:index])
    end

    sprites << args.state.scorpions.map do |sprite|
      scorpion = Scorpion.sprite(x: sprite[:x], y: sprite[:y], attack_direction: sprite[:attack_direction])
      Scorpion.animate(args: args, scorpion: scorpion, attack_started_at: sprite[:attack_started_at], attack_direction: sprite[:attack_direction])
    end

    sprites << args.state.boulders.map do |sprite|
      boulder_sprite(x: sprite[:x], y: sprite[:y])
    end


    args.outputs.sprites << sprites
  end

  def render_nests(args)
    sprites = []

    sprites << args.state.nests.map do |nest|
      nest_sprite(x: nest[:x], y: nest[:y])
    end

    sprites << args.state.empty_nests.map do |nest|
      nest_sprite(x: nest[:x], y: nest[:y], empty: true)
    end

    args.outputs.sprites << sprites
  end

  def tile_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 98,
      h: 98,
      path: "sprites/tile_floor.png",
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

  def boulder_sprite(x:, y: )
    {
      x: x,
      y: y,
      w: 100,
      h: 100,
      path: "sprites/boulder.png",
    }
  end

  def nest_sprite(x:, y:, empty: false )
    {
      x: x,
      y: y,
      w: 100,
      h: 100,
      path: "sprites/nest#{'_empty' if empty}.png",
    }
  end
end