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
    args.state.hiding_shake_started_at ||= args.tick_count
    args.state.finish_point = { x: nil, y: nil }

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
    args.state.finish_point = { x: nil, y: nil }
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

        tile_data = args.state.level_data["Tiles"][0][:tiles][row][col]

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
          args.state.boulders << { x: x, y: y, w: 100, h: 100, hiding_something: tile_data == 'b' }
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

  def render_ui(args)
    render_finish(args)
    render_level_info(args)
  end

  def render_level_info(args)
    labels = []
    labels << {
      x: 1280 - 57,
      y: 103,
      text: "Level",
      r: 250,
      g: 250,
      b: 250
    }.label!

    labels << {
      x: 1280 - 48,
      y: 77,
      text: "#{args.state.level}/9",
      r: 250,
      g: 250,
      b: 250
    }.label!

    time_taken =
    if args.state.ended_level_at == 0
      args.state.tick_count - args.state.started_level_at
    else
      args.state.ended_level_at - args.state.started_level_at
    end
    labels << {
      x: 1280 - 58,
      y: 38,
      text: TimeUtils.ticks_to_time_string(time_taken),
      r: 250,
      g: 250,
      b: 250
    }.label!

    args.outputs.primitives << labels
  end

  def render_finish(args)
    fp = args.state.finish_point
    buffer = 30
    args.state.interactables.finish_rect = {
      x: fp.x + (buffer / 2),
      y: fp.y + (buffer / 2),
      w: TILE_SIZE - buffer,
      h: TILE_SIZE - buffer
    }

    args.outputs.debug << args.state.interactables.finish_rect.border if args.state.debug
    args.outputs.primitives << { x: fp.x + 20, y: fp.y + 60, text: "FINISH", r: 250, g: 250, b: 250 }.label!

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

    sprites << args.state.boulders.map.with_index do |sprite, i|
      if sprite.hiding_something
        shake_started = sprite.hiding_shake_started_at ||= args.tick_count
        duration = 120
        wait_before_shake = 10 + (180 / i)
        wait_between_shakes = 150
        max_offset = 4

        # puts "wait before shake: #{wait_before_shake}"

        should_shake = wait_before_shake + shake_started + duration > args.tick_count
        should_wait_to_start = shake_started + wait_before_shake > args.tick_count
        should_wait_before_reset = wait_before_shake + shake_started + duration <= args.tick_count
        should_reset = wait_before_shake + shake_started + duration + wait_between_shakes < args.tick_count

        # puts "should_shake: #{should_shake}, should_wait: #{should_wait_to_start}, should_reset: #{should_reset}"
      #  puts "shake_started: #{args.state.hiding_shake_started_at}"
      #  puts "shake_with_duration: #{shake_started + duration} (#{args.tick_count})"

        offset_x, offset_y = if should_reset
            sprite.hiding_shake_started_at = args.tick_count
            [0, 0]
          elsif should_wait_to_start
            [0, 0]
          elsif should_wait_before_reset
            [0, 0]
          else
            x = args.easing.ease(
              shake_started,
              args.state.tick_count,
              duration,
              :flip, :quint, :identity, :flip, :quad, :flip
            )
            y = args.easing.ease(
              shake_started,
              args.state.tick_count,
              duration,
              :quint, :identity, :flip, :quint, :flip, :quad
            )
            [max_offset * x, max_offset * y]
          end

        boulder_sprite(
          x: sprite[:x] + offset_x,
          y: sprite[:y] + offset_y,
        )
      else
        boulder_sprite(x: sprite[:x], y: sprite[:y])
      end
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