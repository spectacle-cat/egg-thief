module Scorpion
  extend self

  TILE_SIZE = 100

  def to_border
    [
      scorpion.x, scorpion.y, scorpion.w, scorpion.h
    ]
  end

  def animating?(args, scorpion)
    duration = 60
    start_time = scorpion[:attack_started_at]

    return false unless start_time

    args.tick_count < (start_time + duration)
  end

  def animate(args:, scorpion:, attack_started_at:, attack_direction:)
    duration = 60
    start_time = attack_started_at

    return unless attack_started_at
    return if args.tick_count > (start_time + duration)

    current_progress = args.easing.ease(
      start_time,
      args.state.tick_count,
      duration,
      :identity
    )

    over_halfway = args.tick_count > (start_time + (duration / 2))

    if over_halfway
      move_in(scorpion, attack_direction, current_progress)
    else
      move_out(scorpion, attack_direction, current_progress)
    end

    scorpion
  end

  def move_out(scorpion, attack_direction, current_progress)
    offset = TILE_SIZE * current_progress
    case attack_direction
    when :up
      scorpion[:y] += offset
    when :down
      scorpion[:y] -= offset
    when :left
      scorpion[:x] -= offset
    when :right
      scorpion[:x] += offset
    end
  end

  def move_in(scorpion, attack_direction, current_progress)
    offset = TILE_SIZE - (TILE_SIZE * current_progress)
    case attack_direction
    when :up
      scorpion[:y] += offset
    when :down
      scorpion[:y] -= offset
    when :left
      scorpion[:x] -= offset
    when :right
      scorpion[:x] += offset
    end
  end

  def flip_direction(direction)
    case direction
    when :up then :down
    when :down then :up
    when :left then :right
    when :right then :left
    else
      direction
    end
  end

  def sprite(x: , y:, w: 75, h: 75, attack_direction: :up)
    start_looping_at = 0
    number_of_sprites = 4
    number_of_frames_to_show_each_sprite = 6
    does_sprite_loop = true

    tile_index =
      start_looping_at.frame_index(
        number_of_sprites,
        number_of_frames_to_show_each_sprite,
        does_sprite_loop
      )

    {
      path: "sprites/scorpion.png",
      tile_x: 0 + (tile_index * 416),
      tile_y: 0,
      tile_w: 416,
      tile_h: 421,
      **sprite_position(x, y, w, h, attack_direction),
    }
  end

  def sprite_position(x, y, w, h, attack_direction)
    angle =
      case attack_direction
      when :up
        0
      when :down
        180
      when :left
        90
      when :right
        270
      end

    x_gutter = (TILE_SIZE - w) / 2
    y_gutter = (TILE_SIZE - h) / 2
    tile_diff = 30

    offset =
      case attack_direction
      when :up
        y_gutter += tile_diff
      when :down
        y_gutter -= tile_diff
      when :right
        x_gutter += tile_diff
      when :left
        x_gutter -= tile_diff
      end

    {
      x: x + x_gutter,
      y: y + y_gutter,
      w: w,
      h: h,
      angle: angle,
    }
  end
end