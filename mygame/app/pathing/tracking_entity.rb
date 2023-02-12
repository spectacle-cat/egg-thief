class TrackingEntity
  attr_reader :track
  attr_accessor :check_position_ticks, :last_checked_at,
    :position, :speed, :direction, :angle

  class Position
    attr_accessor :point, :angle

    def initialize(point:, angle:)
      raise "no point" if point.nil?
      @point = point
      @angle = angle
    end

    def move(normalized_direction, speed)
      # puts "point before: #{point.serialize}"
      # puts "direction * speed: #{v.serialize}"
      self.point = next_point(normalized_direction, speed)
      # puts "point after: #{point.serialize}"
    end

    def next_point(normalized_direction, speed)
      point + Vector.build(normalized_direction * speed)
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
    @check_position_ticks = 10 # frames
    last_checked_at = 0

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
    if check_position?(args)
      last_checked_at = args.tick_count
      if reached_current_point?
        puts "position before: #{position.serialize}"
        puts "track next step (#{track.next_step[:index]}) - x: #{track.next_step[:x]}, y: #{track.next_step[:y]}"


        track.update!(position)
        puts "position after: #{position.serialize}"

        self.speed = step_speed
        self.direction = direction_from_position
        self.angle = step_angle
        # raise if track.next_step[:index] == 10
      end
      move
    else
      move
    end

    args.outputs.debug << [ 100, 100, "current step: #{track.current_step[:index]}" ].label

    self
  end

  private

  def move
    # puts "position before: #{position.serialize}"
    position.move(direction, speed)
    # puts "direction: #{direction}"
    # puts "speed: #{speed}"
    # puts "position after: #{position.serialize}"
    # raise
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
    puts "top speed: #{track.top_speed}"
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
    (($geometry.angle_to track.current_step, track.next_step)) - 90
  end

  def direction_from_position
    direction_x = (track.next_step[:x] - position.x)
    direction_y = (track.next_step[:y] - position.y)
    puts "track next step (#{track.next_step[:index]}) - x: #{track.next_step[:x]}, y: #{track.next_step[:y]}"

    Vector.new(x: direction_x, y: direction_y).normalize
  end

  def reached_current_point?
    # overshot? make this a line past the point or something
    close_enough?
    # overshot?
  end

  def close_enough?(strategy: :percent)
    distance_allowance =
      case strategy
      when :pixels
        buffer = 30 # pixels
        distance_between(track.current_step, track.next_step) - buffer
      when :percent
        buffer = 0.8
        distance_between(track.current_step, track.next_step) * buffer
      else
        raise "Unknown strategy: #{strategy}"
      end

    begin
      distance_between(position, track.next_step) < distance_allowance
    rescue
      puts "distance_between(position, track.next_step) < distance_allowance
"
      puts "distance_between(#{position}, #{track.next_step}) < #{distance_allowance}"
      raise
    end
  end

  def overshot?
    puts "distance_between(track.current_step, track.next_step):"
    puts "#{distance_between(track.current_step, track.next_step)}"
    puts "distance_between(position, track.next_step):"
    puts "#{distance_between(position, track.next_step)}"

    distance_between(track.current_step, track.next_step) * 0.9 <=
      distance_between(position, track.next_step)
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