module TileBoard
  extend self

  ROWS = 7
  ROW_GUTTER = 10
  COLUMNS = 12
  COLUMN_GUTTER = 5
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
    args.state.finish_point = nil

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
    args.state.enemies.roadrunners = []
    args.state.enemies.hawks = []
    args.state.enemies.owls = []
    args.state.enemies.scorpions = []
    args.state.finish_point = nil
  end

  def reset_score!(args)
    args.state.nests = args.state.nests + args.state.empty_nests
    args.state.empty_nests = []

    args.state.collected_nests = args.state.collected_nests - args.state.nests
  end

  def build_tiles(args)
    args.state.board[:tiles] = []
    index_counter = 0

    0.upto(args.state.board[:rows] - 1).each do |row|
      0.upto(args.state.board[:columns] - 1).each do |col|
        index_counter += 1

        y = (row * 100) + ROW_GUTTER
        x = (col * 100) + COLUMN_GUTTER

        tile_data = args.state.level_data["Tiles"][:tiles][row][col]

        tile = {
          type: :floor,
          column: col,
          row: row,
          index: index_counter,
          y: y,
          x: x,
          w: TILE_SIZE,
          h: TILE_SIZE,
          hide_from_enemy_fov: ['b', 'B', 'C', 'F', 'S'].include?(tile_data)
        }

        args.state.tiles << tile

        if tile_data == 'C'
          args.state.cover << { x: x, y: y, index: [1, 2, 3, 4].sample }
        end

        if tile_data == 'B' || tile_data == 'b'
          args.state.boulders << { x: x, y: y, w: 100, h: 100 }
        end

        if tile_data == 'b'
          args.state.scorpions << { x: x, y: y, w: 100, h: 100 }
        end

        if ['1', '2', '3', '4'].include?(tile_data)
          args.state.nests << {
            x: x, y: y,
            collision_box: { x: x + 33, y: y + 33, w: 33, h: 33 },
            egg_type: tile_data,
            uid: "#{args.state.level}_#{tile_data}"
          }
          args.state.total_nests += 1
        end

        if tile_data == 'S'
          args.state.start_point.x = x
          args.state.start_point.y = y
        end

        if tile_data == 'F'
          args.state.finish_point.x = x
          args.state.finish_point.y = y
        end
      end
    end
  end

  def can_walk_to(args, x:, y:)
    player_collider = Player.player_collision_box(args, x: x, y: y)

    !args.state.boulders.any_intersect_rect?(player_collider) and !outside_of_board?(args, player_collider)
  end

  def outside_of_board?(args, player_collider)
    if player_collider.x > 1280 - 100 - 40
      true
    elsif player_collider.x < -10
      true
    elsif player_collider.y > (720 - 50)
      true
    elsif player_collider.y < 10
      true
    else
      false
    end
  end

  def render_tiles(args)
    sprites = []
    args.state.tiles.map do |tile|
      sprites << tile_sprite(x: tile[:x], y: tile[:y])
    end

    sprites << Scoring::BackgroundSprite.new

    args.state.nests.each do |n|
      sprites << Scoring::EggCounter.new(index: n[:egg_type].to_i, enabled: false)
    end

    args.state.empty_nests.each do |n|
      sprites << Scoring::EggCounter.new(index: n[:egg_type].to_i, enabled: true)
    end

    args.outputs.sprites << sprites
  end

  def render_finish(args)
    fp = args.state.finish_point
    args.state.interactables.finish_rect = [fp.x, fp.y, TILE_SIZE, TILE_SIZE]
    # args.outputs.primitives << finish_border.solid
    # args.outputs.labels << [fp.x + 30, fp.y + 20, "EXIT"]

    args.outputs.sprites << {
      x: fp.x,
      y: fp.y,
      w: TILE_SIZE,
      h: TILE_SIZE,
      path: 'sprites/exit.png'
    }
  end

  def render_obstacles(args)
    sprites = []

    sprites << args.state.scorpions.map do |scorpion|
      scorpion.sprite = Enemies::Scorpion.sprite(x: scorpion[:x], y: scorpion[:y], attack_direction: scorpion[:attack_direction])
      Enemies::Scorpion.animate(
        args: args,
        scorpion: scorpion.sprite,
        attack_started_at: scorpion[:attack_started_at],
        attack_direction: scorpion[:attack_direction]
      )
    end

    sprites << args.state.boulders.map do |sprite|
      boulder_sprite(x: sprite[:x], y: sprite[:y])
    end

    sprites << args.state.cover.map do |cover|
      shrub_sprite(x: cover[:x], y: cover[:y], index: cover[:index])
    end

    args.outputs.sprites << sprites
  end

  def render_nests(args)
    sprites = []
    eggs = []

    sprites << args.state.nests.map do |nest|
      eggs << egg_sprite(x: nest[:x], y: nest[:y], egg_type: nest[:egg_type])
    end

    sprites << args.state.empty_nests.map do |nest|
      nest_sprite(x: nest[:x], y: nest[:y])
    end

    args.outputs.sprites << sprites
    args.outputs.sprites << eggs
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

  def shrub_sprite(x:, y: , index: [1, 2, 3, 4].sample)
    expand_by = 15

    {
      x: x - (expand_by / 2),
      y: y - (expand_by / 2),
      w: 100 + expand_by,
      h: 100 + expand_by,
      path: "sprites/tuft_#{index}.png",
    }
  end

  def boulder_sprite(x:, y:)
    {
      x: x,
      y: y,
      w: 100,
      h: 100,
      path: "sprites/boulder.png",
    }
  end

  def nest_sprite(x:, y: )
    {
      x: x - 50,
      y: y - 50,
      w: 200,
      h: 200,
      path: "sprites/nest_empty.png",
    }
  end

  def egg_sprite(x:, y: , egg_type: )
    egg_type = egg_type.to_i
    egg_type = egg_type - 3 if egg_type > 3

    {
      x: x - 50,
      y: y - 50,
      w: 200,
      h: 200,
      path: "sprites/EGG_#{egg_type}.png",
    }
  end
end