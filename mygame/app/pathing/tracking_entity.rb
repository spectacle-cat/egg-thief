class TrackingEntity
  attr_reader :track
  attr_accessor :check_position_ticks, :last_checked_at,
    :position, :speed, :direction, :angle, :sprint

  BASE_SPEED = 0.6
  SPRINT_SPEED = 1.1
  CORNER_SPEED = 0.7
  CHECK_POSITION_TICKS = 10

  class Position
    attr_accessor :point, :angle

    def initialize(point:, angle:)
      @point = Vector.build(point)
      @angle = angle
    end

    def move(normalized_direction, speed)
      self.point = next_point(normalized_direction, speed)
    end

    def next_point(normalized_direction, speed)
      point + Vector.build(normalized_direction) * speed
    end

    def x
      point.x
    end

    def y
      point.y
    end

    def inspect
      serialize
    end

    def serialize
      { x: x.to_f, y: y.to_f, angle: angle.to_f }
    end
  end

  def initialize(track:)
    @check_position_ticks = CHECK_POSITION_TICKS # frames
    last_checked_at = 0
    @sprint = false

    @track = track
    step = track.current_step.dup
    @position = Position.new(
      point: Vector.build(step),
      angle: step[:angle],
    )

    @speed = step_speed
    @direction = direction_from_position
    @angle = step_angle
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
        track.update!(position)

        self.speed = step_speed
        self.direction = direction_from_position
        self.angle = step_angle
      end
      move
    else
      move
    end

    self
  end

  private

  def move
    position.move(direction, speed)
    turn
  end

  def turn
    angle_increment = (step_angle - position.angle) / check_position_ticks
    # (maybe have to change to -180/180 angles)
    position.angle += angle_increment
  end

  def check_position?(args)
    (args.tick_count % check_position_ticks) == 0
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

  def step_angle
    if track.previous_step[:corner] == true && track.current_step[:corner] == true
      (($geometry.angle_to track.next_step, track.lookup_step_after(track.next_step))) - 90
    else
      (($geometry.angle_to track.current_step, track.next_step)) - 90
    end
  end

  def direction_from_position
    direction_x = (track.next_step[:x] - position.x)
    direction_y = (track.next_step[:y] - position.y)
    puts "track next step (#{track.next_step[:index]}) - x: #{track.next_step[:x]}, y: #{track.next_step[:y]}"

    Vector.new(x: direction_x, y: direction_y).normalize
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

    distance_between(position, track.next_step) < distance_allowance
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
      position: position.serialize,
      speed: speed.to_s,
      direction: direction.to_s,
      angle: angle.to_s,
    }
  end

  def show_debug(args)
    args.outputs.debug << [ 100, 100, "current step: #{track.current_step[:index]} (sprint: #{sprint == true})" ].label

    args.outputs.debug << [
      track.current_step[:x], track.current_step[:y],
      position.x, position.y, 0, 200, 250
    ].line

    next_point = position.next_point(direction_from_position, speed)
    args.outputs.debug << [
      position.x, position.y,
      next_point.x, next_point.y, 0, 0, 0
    ].line
  end
end