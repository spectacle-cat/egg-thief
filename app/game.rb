require 'app/common/time_utils.rb'
require 'app/level_loader.rb'
require 'app/common/sprite.rb'
require 'app/common/direction.rb'
require 'app/common/vector.rb'
require 'app/common/fov.rb'
require 'app/common/particle_system.rb'
require 'app/player.rb'
require 'app/enemies.rb'
require 'app/enemies/scorpion.rb'
require 'app/enemies/roadrunner.rb'
require 'app/enemies/hawk.rb'
require 'app/enemies/owl.rb'
require 'app/pathing/track_builder.rb'
require 'app/pathing/track_loop.rb'
require 'app/pathing/single_track.rb'
require 'app/pathing/tracking_entity.rb'
require 'app/pathing/points_path.rb'
require 'app/tile_board.rb'
require 'app/collisions.rb'
require 'app/scoring/background_sprite.rb'
require 'app/scoring/egg_counter.rb'
require 'app/end_of_level_popup.rb'
require 'app/level_stats.rb'

module Game
  extend self

  RESTART_DURATION = 60 * 1.5

  def tick args
    # args.gtk.slowmo! 5
    args.state.debug ||= false
    args.outputs.background_color = [52, 43, 14]
    args.state.collected_nests ||= []
    args.state.total_nests ||= 0
    args.state.level ||= 1
    args.state.started_level_at ||= 0
    args.state.ended_level_at ||= 0
    args.state.end_level ||= false
    args.state.exit_level ||= false
    args.state.scene ||= :level
    args.state.fade_in_started_at ||= nil
    args.state.fade_out_started_at ||= nil
    args.state.enemies.roadrunners ||= []
    args.state.enemies.hawks ||= []
    args.state.enemies.owls ||= []
    args.state.enemies.scorpions ||= []
    args.state.particles ||= []
    @stats ||= LevelStats.new(args)

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

    args.outputs.debug << args.gtk.framerate_diagnostics_primitives if args.state.debug
  end

  def game_completed_scene(args)
    render_game_complete(args)

    if args.inputs.keyboard.space || args.inputs.controller_one.truthy_keys.any?
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
      Enemies.setup(args)
      args.state.fade_in_started_at = args.state.tick_count
    end

    end_level(args) if args.state.end_level == true

    render_level(args, paused: args.state.end_level)
    continue_fade_in(args) if args.state.fade_in_started_at
  end

def end_level(args)
  if args.state.popup.nil?
    stats.save_for_current_level if args.state.ended_level_at == 0

    args.state.popup = EndOfLevelPopup.new(
      stats.current_level.eggs_collected,
      stats.current_level.time_taken
    )
  end

  args.state.popup.render(args)
end


def render_button(args, x, y, width, height, text)
  args.outputs.borders << [x, y, width, height]
  args.outputs.labels << [x + width / 2, y + height / 2, text, 0, 1]

  clicked = false
  if args.inputs.mouse.click && clicked_within?(args, x, y, width, height)
    clicked = true
  end

  clicked
end

def clicked_within?(args, x, y, width, height)
  mouse_x = args.inputs.mouse.x
  mouse_y = args.inputs.mouse.y

  mouse_x.between?(x, x + width) && mouse_y.between?(y, y + height)
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
    args.state.end_level = false

    if last_level?(args)
      args.state.scene = :game_completed
      args.state.exit_level = false
    else
      args.state.level += 1
      setup_level(args)
    end
  end

  def render_level(args, paused: false)
    TileBoard.render_tiles(args)
    TileBoard.render_ui(args)
    TileBoard.render_nests(args)

    unless paused
      Player.tick(args, paused: paused)

      player_collider = Player.player_collision_box(args, buffer: 0)
      Collisions.new(args, player_collider).run!

      args.outputs.debug << player_collider.border if args.state.debug
    end

    TileBoard.render_obstacles(args)
    Enemies.tick(args, paused: paused)
  end

  def render_particles
    if args.state.player.started_running_at == args.tick_count
      emitter = Emitters::Trail.new(
        force: 2
      )

      args.state.particles << ParticleSystem.new(
        x: args.state.player.x,
        y: args.state.player.y,
        rate: 15,
        count: 10,
        emitter: emitter
      )
    end

    args.state.particles.each do |particles|
      particles.x = args.state.player.x
      particles.y = args.state.player.y

      particles.update(args)
      args.state.particles.delete(particles) if particles.dead?
      particles.render
    end
  end

  def restart_level!(args)
    args.state.restarted_level_at = args.tick_count
    args.state.ended_level_at = 0
    args.state.started_level_at = args.tick_count
    args.state.scene = :restart_level
    args.state.popup = nil

    args.state.enemies[:hawks].each { |enemy| enemy.reset! }
    args.state.enemies[:owls].each { |enemy| enemy.reset! }
    args.state.enemies[:roadrunners].each { |enemy| enemy.reset! }
  end

  def restart_level(args)
    TileBoard.render_tiles(args)
    TileBoard.render_ui(args)
    TileBoard.render_nests(args)

    manual_restart = args.state.end_level
    Player.render_player_sprite(args, is_dead: !manual_restart)

    TileBoard.render_obstacles(args)

    if manual_restart
      unfreeze_gameplay(args)
      return
    end

    if args.tick_count > (args.state.restarted_level_at + RESTART_DURATION)
      unfreeze_gameplay(args)
    end
  end

  def unfreeze_gameplay(args)
    args.state.scene = :level
    args.state.restarted_level_at = nil
    Player.reset(args)
    Player.place_at_start(args)
    TileBoard.reset_score!(args)
    args.state.end_level = false
  end

  def last_level?(args)
    next_level = args.state.level + 1
    data = args.gtk.read_file(LevelLoader.level_path(next_level))
    result = data.to_s.length == 0

    result
  end

  def load_level(args)
    args.state.level_data =
      LevelLoader.new(args, level_number: args.state.level).level_data
  end

  def setup_level(args)
    Player.reset(args)
    TileBoard.reset(args)
    load_level(args)
    TileBoard.setup(args)
    Enemies.setup(args)

    args.state.exit_level = false
    args.state.end_level = false
    args.state.started_level_at = args.tick_count
    args.state.ended_level_at = nil
    args.state.popup = nil
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
      text: "Press SPACE/controller button to restart",
      size_enum: 5,
    ]
    args.outputs.labels << labels
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

  def stats
    @stats
  end
end