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
    # v = (Vector.build(track.current_step) - Vector.build(track.next_step)).normalize
    v = (Vector.build(track.next_step) - Vector.build(track.current_step)).normalize
    t = tangent(track.current_step, track.next_step)
    d = t.dot(v)

    w = (Vector.build(track.current_step) - Vector.build(track.previous_step)).normalize
    tt = tangent(track.previous_step, track.current_step)
    dd = t.dot(v)


    # a = step_angle
    theta = (d * 180)
    a = theta > 90 ? 180 - theta : theta
    delta = ((a / check_position_ticks) * progress) * speed

    # puts "v: #{v}"
    # puts "t: #{t}"
    # puts "d: #{d}"
    # puts "check_position_ticks: #{check_position_ticks}"
    # puts "progress: #{progress}"
    # puts "step_angle: #{step_angle}"
    # puts "delta: #{delta}"
    # puts "theta: #{theta}"
    # puts "a: #{a}"
    # raise "turning"

    scale = 50
    position = next_point(direction, speed)
    v1 = v + position
    v2 = (v * scale) + position
    t1 = t + position
    t2 = (t * scale) + position

    v3 = w + position
    v4 = (w * scale) + position
    t3 = tt + position
    t4 = (tt * scale) + position

    args.outputs.lines << [v1.x, v1.y, v2.x, v2.y, 150, 0, 0]
    # args.outputs.lines << [t1.x, t1.y, t2.x, t2.y, 0, 0, 150]
    args.outputs.lines << [v3.x, v3.y, v4.x, v4.y, 200, 200, 200]
    # args.outputs.lines << [t3.x, t3.y, t4.x, t4.y, 250, 250, 250]

    if d < 0
      # sprite.angle -= delta

    else
      # sprite.angle += delta
    end
  end

  def tangent(prev_point, point, length: 1)
    v = { x: point.x - prev_point.x, y: point.y - prev_point.y }

    normal = Vector.new(x: v.x, y: v.y).normalize
    t = { x: normal.y, y: -normal.x }

    Vector.new(x: t[:x] * length, y: t[:y] * length)
  end

  def unit_vector_x
    v1 = Vector.new(x: sprite.origin_point.x, y: sprite.origin_point.y)
    v2 = (Vector.new(x: track.next_step.x, y: track.next_step.y))

    unit_vector = (v1 - v2).normalize
    unit_vector.x
  end

  def unit_vector_x_test(args)
    vp = Vector.new(x: track.previous_step.x, y: track.previous_step.y)
    v1 = Vector.new(x: track.current_step.x, y: track.current_step.y) - vp
    v2 = Vector.new(x: track.next_step.x, y: track.next_step.y) - vp

    # vp = vp.normalize
    v1 = v1.normalize
    v2 = v2.normalize
    vc = Vector.new(x: -v1.y, y: v1.x)

    args.outputs.debug << [
      vp.x, vp.y,
      v1.x, v1.y, 255, 0, 255
    ].line

    args.outputs.debug << [
      vp.x, vp.y,
      v2.x, v2.y, 255, 255, 0
    ].line

    args.outputs.debug << [
      vp.x, vp.y,
      vc.x, vc.y, 0, 0, 0
    ].line

    "#{Math.atan2(v1.x, v1.y)} #{Math.atan2(v2.x, v2.y)}"

    # v1 = (v1 - vp).normalize
    # v2 = (v2 - vp).normalize

    # args.outputs.debug << [
    #   0 + 500, 0 + 500,
    #   (v1.x * 100) + 500, (v1.y * 100) + 500, 255, 0, 255
    # ].line

    # args.outputs.debug << [
    #   0 + 500, 0 + 500,
    #   (v2.x * 100) + 500, (v2.y * 100) + 500, 255, 255, 0
    # ].line


    # d = v1.dot(v2)
    # unit_vector = (v2 - v1)
    # Math.cos(d)
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