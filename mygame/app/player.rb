module Player
  extend self

  SPEED = 8

  def reset(args)
    args.state.player = nil
  end

  def tick args
    args.state.player.w ||= 35
    args.state.player.h ||= 95

    args.state.player.x ||= args.state.player.start_point.x + (
      (TileBoard::TILE_SIZE - args.state.player.w) / 2
    )
    args.state.player.y ||= args.state.player.start_point.y

    args.state.player.lr ||= :none
    args.state.player.ud ||= :none
    args.state.player.last_angle ||= 0
    args.state.player.is_moving = false

    set_player_input(args)
    move_player(args)
    check_collisions(args)

    if normalized_speed(args) > 0
      args.state.player.started_running_at ||= args.state.tick_count
    end

    # if no arrow keys are being pressed, set the player as not moving
    if !args.inputs.keyboard.directional_vector
      args.state.player.started_running_at = nil
    end

    # render player as standing or running
    if args.state.player.started_running_at
      args.outputs.sprites << running_sprite(args)
    else
      args.outputs.sprites << standing_sprite(args)
    end
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

  def check_collisions(args)
    player_collider = player_collision_box(args)

    args.state.nests.delete_if do |nest|
      hit = nest[:collision_box].intersect_rect?(player_collider)

      args.state.collected_nests << nest if hit

      hit
    end

    if args.state.interactables.finish_rect.intersect_rect?(player_collider)
      args.state.exit_level = true
    end
  end

  def player_collision_box(args)
      target_player_rect = {
      x: args.state.player.x,
      y: args.state.player.y,
      w: args.state.player.w,
      h: args.state.player.h,
    }
    args.state.player_collider = player_collider = {
      w: 50,
      h: 50,
    }.center_inside_rect(target_player_rect)

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

  def player_sprite args, index: 0
    {
      x: args.state.player.x,
      y: args.state.player.y,
      w: args.state.player.w,
      h: args.state.player.h,
      path: "sprites/Lizzie_350x_950_#{index}.png",
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