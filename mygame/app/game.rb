require 'app/player.rb'
require 'app/tile_board.rb'
require 'app/collisions.rb'

module Game
  extend self

  def tick args
    args.outputs.solids << background(args)
    args.state.collected_nests ||= []
    args.state.total_nests ||= 0
    args.state.level ||= 1
    args.state.exit_level ||= false
    args.state.scene ||= :level
    args.state.fade_in_started_at ||= nil
    args.state.fade_out_started_at ||= nil

    case args.state.scene
    when :level
      level_scene(args)
    when :restart_level
      restart_level(args)
    when :game_completed
      game_completed_scene(args)
    when :game_over
      # game_over_scene
    else
      raise "UNKNOWN SCENE STATE: #{args.state.scene}"
    end

    args.outputs.debug << args.gtk.framerate_diagnostics_primitives
  end

  def game_completed_scene(args)
    render_game_complete(args)

    if args.inputs.keyboard.space
      args.state.level = 1
      args.state.scene = :level
      reset_score(args)
      setup_level(args)
    end
  end

  def level_scene(args)
    return transition_to_next_level(args) if args.state.exit_level

    if args.tick_count == 0
      load_level(args)
      TileBoard.setup(args)
      args.state.fade_in_started_at = args.state.tick_count
    end

    render_level(args)
    show_score(args)
    continue_fade_in(args) if args.state.fade_in_started_at
  end

  def continue_fade_in(args)
    tick_duration = 60
    tick_delta = args.state.tick_count - args.state.fade_in_started_at
    percentage_delta = (tick_duration / 100) * tick_delta
    alpha_delta = (255 / 100) * percentage_delta
    alpha = 255 - alpha_delta

    if alpha > 0
      args.outputs.primitives << {
        x: args.grid.x,
        y: args.grid.y,
        w: args.grid.w,
        h: args.grid.h,
        r: 0,
        g: 0,
        b: 0,
        a: alpha
      }.solid!
    end

    args.state.fading_in_started_at = nil if tick_delta >= tick_duration
  end

  def transition_to_next_level(args)
    args.state.fade_in_started_at = args.state.tick_count

    if last_level?(args)
      args.state.scene = :game_completed
      args.state.exit_level = false
    else
      args.state.level += 1
      setup_level(args)
    end
  end

  def render_level(args)
    TileBoard.render_tiles(args)
    TileBoard.render_finish(args)
    TileBoard.render_nests(args)

    Player.tick(args)
    Collisions.new(args, Player.player_collision_box(args)).run!

    TileBoard.render_obstacles(args)
  end

  def restart_level!(args)
    args.state.restarted_level_at = args.tick_count
    args.state.scene = :restart_level
  end

  def restart_level(args)
    TileBoard.render_tiles(args)
    TileBoard.render_finish(args)
    TileBoard.render_nests(args)

#    Player.reset(args)
    Player.render_player_sprite(args, is_dead: true)

    TileBoard.render_obstacles(args)

    if args.tick_count > (args.state.restarted_level_at + 60)
      args.state.scene = :level
      args.state.restarted_level_at = nil
      Player.place_at_start(args)
    end
  end

  def last_level?(args)
    next_level = args.state.level + 1
    data = args.gtk.read_file(level_path(next_level))
    result = data.to_s.length == 0

    puts result
    result
  end

  def level_path(level)
    "data/levels/level_#{level}.txt"
  end

  def load_level(args)
    data = args.gtk.read_file(level_path(args.state.level))
    rows = data.split

    args.state.level_data = rows.reverse.map { |row| row.chars }
  end

  def setup_level(args)
    Player.reset(args)
    TileBoard.reset(args)
    load_level(args)
    TileBoard.setup(args)

    args.state.exit_level = false
  end

  def reset_score(args)
    args.state.collected_nests = []
    args.state.total_nests = 0
  end

  def render_game_complete(args)
    labels = []
    labels << [
      x: args.grid.left.shift_right(720 - 275),
      y: args.grid.top.shift_down(200),
      text: "CONGRATULATIONS!",
      size_enum: 20,
    ]

    labels << [
      x: args.grid.left.shift_right(720 - 270),
      y: args.grid.top.shift_down(350),
      text: "You've completed the Game!",
      size_enum: 10,
    ]

    labels << [
      x: args.grid.left.shift_right(720 - 270),
      y: args.grid.top.shift_down(400),
      text: "Eggs #{args.state.collected_nests.count} / #{args.state.total_nests}",
      size_enum: 5,
    ]

    labels << [
      x: args.grid.left.shift_right(720 - 270),
      y: args.grid.top.shift_down(500),
      text: "Press SPACE to restart",
      size_enum: 5,
    ]
    args.outputs.labels << labels
  end

  def show_score(args)
    args.outputs.labels << [
      x: 50,
      y: 700,
      text: "Eggs: #{args.state.collected_nests.count}",
      size_enum: 10,
    ]
  end

  def background(args)
    [
      x: 0,
      y: 0,
      w: args.grid.w,
      h: args.grid.h,
      r: 30,
      g: 30,
      b: 30,
    ]
  end
end