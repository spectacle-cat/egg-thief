class TrackingEntity
  attr_reader :track
  attr_accessor :check_position_ticks, :last_checked_at
    :speed, :direction, :direction, :angle

  class Position
    attr_accessor :point, :angle

    def initialize(point:, angle:)
      @point = point
      @angle = angle
    end

    def move(normalized_direction, speed)
      point *= (normalized_direction * speed)
    end

    def x
      point.x
    end

    def y
      point.y
    end
  end

  def initialize(track)
    @track = track
    step = track.current_step.dup
    @speed = step_speed
    @direction = direction_from_position
    @angle = step_angle

    @position = Position.new(
      point: Vector.build(step),
      angle: step[:angle],
    )
    @check_position_ticks = 10 # frames
    last_checked_at = 0
  end

  def tick(args)
    if check_position?(args)
      last_checked_at = args.tick_count
      track.update!(position) if reached_current_point?

      speed = step_speed
      direction = direction_from_position
      angle = step_angle
      move
    else
      move
    end
  end

  private

  def move
    position.move(normalized_direction, speed)
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
    base_speed = top_speed * 0.5

    if track.current_step[:corner]
      base_speed * 0.7
    elsif track.next_step[:corner]
      base_speed# * 0.3
    elsif track.previous_step[:corner]
      base_speed * 0.7
    else
      base_speed
    end
  end

  def step_angle
    (($geometry.angle_to last_step, next_step)) - 90
  end

  def direction_from_position
    direction_x = (next_step[:x] - position[:x])
    direction_y = (nstep[:y] - position[:y])

    Vector.build(normalize(direction_x, direction_y))
  end

  def reached_current_point?
    close_enough? || overshot?
  end

  def close_enough?(strategy: :pixels)
    distance_allowance =
      case strategy
      when :pixels
        buffer = 25 # pixels
        distance_between(position, next_step) < buffer
      when :percent
        buffer = 0.9
        distance_between(current_step, next_step) * buffer
      else
        raise "Unknown strategy: #{strategy}"
      end

    distance_between(position, next_step) < distance_allowance
  end

  def overshot?
    distance_between(current_step, next_step) <
      distance_between(position, next_step)
  end

  def distance_between(a_vector, b_vector)
    $geometry.distance(a_vector, b_vector)
  end
end