module Player
  extend self

  SPEED = 8

  def reset(args)
    args.state.player = nil
    args.state.player.angle = nil
    args.state.player_collider = nil
  end

  def place_at_start(args)
    set_player_size(args)

    args.state.player.x = args.state.start_point.x + (
      (TileBoard::TILE_SIZE - args.state.player.w) / 2
    )
    args.state.player.y = args.state.start_point.y
  end

  def set_player_size(args)
    args.state.player.w = 100
    args.state.player.h = 100
  end

  def tick args
    if args.state.player.w.nil? || args.state.player.h.nil?
      set_player_size(args)
    end

    if args.state.player.x.nil? || args.state.player.y.nil?
      place_at_start(args)
    end

    raise "no X starting position" unless args.state.player.x
    raise "no Y starting position" unless args.state.player.y

    args.state.player.lr ||= :none
    args.state.player.ud ||= :none
    args.state.player.last_angle ||= 0
    args.state.player.is_moving = false

    set_player_input(args)
    move_player(args)

    if normalized_speed(args) > 0
      args.state.player.started_running_at ||= args.state.tick_count
    end

    # if no arrow keys are being pressed, set the player as not moving
    if !input_for_moving_detected?(args)
      args.state.player.started_running_at = nil
    end


    render_player_sprite(args)
    # args.outputs.debug << args.state.player_collider.border
  end

  def render_player_sprite(args, is_dead: false)
    if is_dead
      args.outputs.sprites << dead_sprite(args)
    elsif args.state.player.started_running_at.nil?
      args.outputs.sprites << standing_sprite(args)
    else args.state.player.started_running_at
      args.outputs.sprites << running_sprite(args)
    end
  end

  def set_player_input(args)
    if args.inputs.right
      args.state.player.lr = :right
    elsif args.inputs.left
      args.state.player.lr = :left
    else
      args.state.player.lr = :none
    end

    if args.inputs.up
      args.state.player.ud = :up
    elsif args.inputs.down
      args.state.player.ud = :down
    else
      args.state.player.ud = :none
    end
  end

  def move_player(args)
    lr = args.state.player.lr
    ud = args.state.player.ud
    speed = normalized_speed(args)

    target_x = args.state.player.x
    target_y = args.state.player.y

    if lr == :left
      target_x -= speed
    elsif lr == :right
      target_x += speed
    end

    if ud == :up
      target_y += speed
    elsif ud == :down
      target_y -= speed
    end

    return if args.state.player.x == target_x &&
      args.state.player.y == target_y

    if TileBoard.can_walk_to(args, x: target_x, y: target_y)
      args.state.player.x = target_x
      args.state.player.y = target_y
    end
  end

  def player_collision_box(args, x: :unset, y: :unset, buffer: 0)
    length = 100 - 10 - buffer
    target_player_rect = {
      x: x == :unset ? args.state.player.x : x,
      y: y == :unset ? args.state.player.y : y,
      w: args.state.player.w,
      h: args.state.player.h,
    }
    lr = args.state.player.lr
    ud = args.state.player.ud

    player_collider =
      if [:left, :right].include?(lr) && [:up, :down].include?(ud)
        { w: length / 2.5, h: length / 2.5, }
      elsif lr == :right || lr == :left
        { w: length * 0.5, h: length / 3.5, }
      elsif ud == :up || ud == :down
        { w: length / 3.5, h: length * 0.5 }
      elsif !args.state.player_collider.x.nil?
        return args.state.player_collider
      else
        { w: length / 3.5, h: length }
      end

    player_collider =
      player_collider.center_inside_rect(target_player_rect)

    offset = length / 5
    diagonal_offset = offset / 2

    if lr == :left && ud == :none
      player_collider[:x] -= offset
    elsif lr == :left && ud == :up
      player_collider[:x] -= diagonal_offset
      player_collider[:y] += diagonal_offset
    elsif lr == :left && ud == :down
      player_collider[:x] -= diagonal_offset
      player_collider[:y] -= diagonal_offset
    elsif lr == :right && ud == :none
      player_collider[:x] += offset
    elsif lr == :right && ud == :up
      player_collider[:x] += diagonal_offset
      player_collider[:y] += diagonal_offset
    elsif lr == :right && ud == :down
      player_collider[:x] += diagonal_offset
      player_collider[:y] -= diagonal_offset
    elsif lr == :none && ud == :none
      player_collider
    elsif lr == :none && ud == :up
      player_collider[:y] += offset
    elsif lr == :none && ud == :down
      player_collider[:y] -= offset
    end

    args.state.player_collider = player_collider
    player_collider
  end


  def normalized_speed(args)
    lr = args.state.player.lr
    ud = args.state.player.ud

    return 0 if [lr, ud].all?(:none)
    return SPEED if [lr, ud].count(:none) == 1
    return SPEED * 0.75 if [lr, ud].none?(:none)
  end

  def facing_angle(args)
    lr = args.state.player.lr
    ud = args.state.player.ud

    new_angle =
      if lr == :left && ud == :none
        90
      elsif lr == :left && ud == :up
        90 - 45
      elsif lr == :left && ud == :down
        90 + 45
      elsif lr == :right && ud == :none
        270
      elsif lr == :right && ud == :up
        270 + 45
      elsif lr == :right && ud == :down
        270 - 45
      elsif lr == :none && ud == :none
        args.state.player.last_angle
      elsif lr == :none && ud == :up
        0
      elsif lr == :none && ud == :down
        180
      end

    args.state.player.last_angle = new_angle
  end

  def standing_sprite args
    player_sprite(args)
  end

  def dead_sprite(args)
    player_sprite(args, index: 0, angle: death_spin(args))
  end

  def death_spin(args)
    spline = [
      [1.0, 0.3, 0.1, 0]
    ]
    angle_easing = args.easing.ease_spline(
      args.state.restarted_level_at,
      args.state.tick_count,
      Game::RESTART_DURATION,
      spline
    )

    angle_offset = (360 * 3) * (1 - angle_easing)
    facing_angle(args) + angle_offset
  end

  def player_sprite(args, index: 0, angle: nil)
    {
      x: args.state.player.x,
      y: args.state.player.y,
      w: args.state.player.w,
      h: args.state.player.h,
      path: "sprites/yellow_lizzie_#{index}.png",
      angle: angle || facing_angle(args),
    }
  end

  def running_sprite args
    number_of_sprites = 2
    number_of_frames_to_show_each_sprite = 10
    does_sprite_loop = true
    start_looping_at = 0

    sprite_index = start_looping_at.frame_index number_of_sprites,
                                              number_of_frames_to_show_each_sprite,
                                              does_sprite_loop

    args.outputs.sprites << player_sprite(args, index: sprite_index)
  end

  def input_for_moving_detected?(args)
    args.inputs.up || args.inputs.down || args.inputs.left || args.inputs.right
  end
end