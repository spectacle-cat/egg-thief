class TrackingEntity
  attr_reader :track
  attr_accessor :check_position_ticks, :last_checked_at,
    :sprite, :speed, :direction, :sprint

  BASE_SPEED = 0.6
  SPRINT_SPEED = 1.1
  CORNER_SPEED = 0.7
  CHECK_POSITION_TICKS = 10

  def initialize(track:, sprite: )
    @check_position_ticks = CHECK_POSITION_TICKS # frames
    last_checked_at = 0
    @sprint = false

    @track = track
    step = track.current_step.dup
    @sprite = sprite.new(origin_point: Vector.build(step), angle: step[:angle])

    @speed = step_speed
    @direction = direction_from_position
  end

  def tick(args)
    if args.inputs.keyboard.key_down.space
      self.sprint = true
    elsif args.inputs.keyboard.key_up.space
      self.sprint = false
    end

    if check_position?(args)
      last_checked_at = args.tick_count
      if reached_current_point?
        track.update!

        self.speed = step_speed
        self.direction = direction_from_position
      end
    end

    move
    turn(progress: ticks_since_last_check(args), args: args)

    self
  end

  private

  def check_position?(args)
    (args.tick_count % check_position_ticks) == 0
  end

  def ticks_since_last_check(args)
    remainder = (args.tick_count % check_position_ticks)

    check_position_ticks - remainder
  end

  def move
    self.sprite.origin_point = next_point(direction, speed)
  end

  def next_point(normalized_direction, speed)
    sprite.origin_point + Vector.build(normalized_direction) * speed
  end

  def turn(progress:, args:)
    position = next_point(direction, speed)
    scale = 50

    ps = Vector.build(track.previous_step)
    cs = Vector.build(track.current_step)
    ns = Vector.build(track.next_step)
    nns = Vector.build(track.lookup_step_after(track.next_step))

    v = Vector.new(x: cs.x - ps.x, y: cs.y - ps.y).normalize
    t = Vector.new(x: v.y, y: -v.x)

    pt = t + position
    pt2 = (t * scale) + pt
    args.outputs.lines << [position.x, position.y, pt2.x, pt2.y, 250, 250, 250]

    origin = cs
    vt = (t - origin).normalize
    vns = (ns - origin).normalize

    angle = (t.x * vns.x) + (t.y * vns.y)
    v2 = (vns * scale) + position

    color = if angle < 0
      [50, 50, 200]
    else
      [200, 50, 50]
    end

    args.outputs.lines << [position.x, position.y, v2.x, v2.y, *color]
    args.outputs.debug << [ 100, 50, "vt: #{vt}" ].label
    args.outputs.debug << [ 100, 25, "angle: #{angle}" ].label

  end

  def step_angle
    # if track.previous_step[:corner] == true && track.current_step[:corner] == true
    #   (($geometry.angle_to current_step, track.lookup_step_after(next_step))) - 90
    # else
    #   (($geometry.angle_to current_step, next_step)) - 90
    # end

    $geometry.angle_to track.current_step, track.next_step
  end

  def direction_from_position
    direction_x = (track.next_step[:x] - sprite.origin_point.x)
    direction_y = (track.next_step[:y] - sprite.origin_point.y)

    Vector.new(x: direction_x, y: direction_y).normalize
  end

  def step_speed
    top_speed = track.top_speed / check_position_ticks
    if sprint
      base_speed = top_speed * SPRINT_SPEED
    else
      base_speed = top_speed * BASE_SPEED
    end

    if track.current_step[:corner]
      base_speed * CORNER_SPEED
    elsif track.next_step[:corner]
      base_speed # * CORNER_SPEED
    elsif track.previous_step[:corner]
      base_speed * CORNER_SPEED
    else
      base_speed
    end
  end

  def reached_current_point?
    close_enough?
  end

  def close_enough?(strategy: :percent)
    distance_allowance =
      case strategy
      when :pixels
        buffer = 30 # pixels
        distance_between(track.current_step, track.next_step) - buffer
      when :percent
        buffer = 0.7
        distance_between(track.current_step, track.next_step) * buffer
      else
        raise "Unknown strategy: #{strategy}"
      end

    distance_between(sprite.origin_point, track.next_step) < distance_allowance
  end

  def distance_between(a_vector, b_vector)
    $geometry.distance(a_vector, b_vector)
  end

  def inspect
    serialize
  end

  def serialize
    {
      check_position_ticks: check_position_ticks.to_s,
      last_checked_at: last_checked_at.to_s,
      position: sprite.serialize,
      speed: speed.to_s,
      direction: direction.to_s,
      target_angle: sprite.angle.to_s,
    }
  end

  def show_debug(args)
    # args.outputs.debug << [
    #   track.current_step[:x], track.current_step[:y],
    #   sprite.origin_point.x, sprite.origin_point.y, 0, 200, 250
    # ].line

    # next_point = next_point(direction_from_position, speed)
    # args.outputs.debug << [
    #   sprite.origin_point.x, sprite.origin_point.y,
    #   next_point.x, next_point.y, 0, 0, 0
    # ].line

    # args.outputs.debug << [ 100, 75, "uvx: #{unit_vector_x}, sprite angle: #{sprite.angle.to_i}" ].label
    # args.outputs.debug << [ 100, 50, "uvx_test: #{unit_vector_x_test(args)}" ].label

  end
end