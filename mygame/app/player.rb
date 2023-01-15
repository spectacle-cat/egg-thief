module Player
  extend self

  SPEED = 4

  def tick args
    args.state.player.x ||= 100
    args.state.player.y ||= 100
    args.state.player.w ||= 100
    args.state.player.h ||= 100
    args.state.player.lr ||= :none
    args.state.player.ud ||= :none
    args.state.player.last_angle || 0

    args.state.player.is_moving = false

    set_player_input(args)
    move_player(args)

    if normalized_speed(args) > 0
      args.state.player.started_running_at ||= args.state.tick_count
    end

    # if no arrow keys are being pressed, set the player as not moving
    if !args.inputs.keyboard.directional_vector
      args.state.player.started_running_at = nil
    end

    # wrap player around the stage
    if args.state.player.x > 1280
      args.state.player.x = -64
      args.state.player.started_running_at ||= args.state.tick_count
    elsif args.state.player.x < -64
      args.state.player.x = 1280
      args.state.player.started_running_at ||= args.state.tick_count
    end

    if args.state.player.y > 720
      args.state.player.y = -64
      args.state.player.started_running_at ||= args.state.tick_count
    elsif args.state.player.y < -64
      args.state.player.y = 720
      args.state.player.started_running_at ||= args.state.tick_count
    end

    # render player as standing or running
    if args.state.player.started_running_at
      args.outputs.sprites << running_sprite(args)
    else
      args.outputs.sprites << standing_sprite(args)
    end
    args.outputs.labels << [30, 700, "Use arrow keys to move around."]
  end

  def set_player_input(args)
      # get the keyboard input and set player properties
    if args.inputs.keyboard.right
      args.state.player.lr = :right
    elsif args.inputs.keyboard.left
      args.state.player.lr = :left
    else
      args.state.player.lr = :none
    end

    if args.inputs.keyboard.up
      args.state.player.ud = :up
    elsif args.inputs.keyboard.down
      args.state.player.ud = :down
    else
      args.state.player.ud = :none
    end
  end

  def move_player(args)
    lr = args.state.player.lr
    ud = args.state.player.ud
    speed = normalized_speed(args)

    if lr == :left
      args.state.player.x -= speed
    elsif lr == :right
      args.state.player.x += speed
    end

    if ud == :up
      args.state.player.y += speed
    elsif ud == :down
      args.state.player.y -= speed
    end
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

  def player_sprite args, index: 0
    {
      x: args.state.player.x,
      y: args.state.player.y,
      w: args.state.player.w,
      h: args.state.player.h,
      path: "sprites/Lizzie_100x100_#{index}.png",
      angle: facing_angle(args),
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
end