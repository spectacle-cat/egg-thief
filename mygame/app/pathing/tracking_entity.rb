class TrackingEntity
  attr_reader :track
  attr_accessor :sprite, :speed, :direction, :sprint,
  :last_update_angle, :last_updated_at,
  :chase_track, :chasing_player, :player_last_spotted

  TICKS_PER_TILE = 30
  SPRINT_MULTIPLIER = 1.3

  def initialize(track:, sprite: )
    @sprint = false

    @track = track
    @chase_track = nil
    step = track.current_step.dup
    @sprite = sprite.new(origin_point: Vector.build(step), angle: step[:angle])
    @last_update_angle = step[:angle]
    @last_updated_at = 0

    @speed = step_speed
    @direction = direction_from_position(step)

    @chasing_player = false
    @player_last_spotted = nil
  end

  def tick(args)
    if args.tick_count % TICKS_PER_TILE == 0
      self.speed = chasing_player? ? sprint_speed : step_speed

      current_track.update!
      self.direction = direction_from_position(current_track.next_step)

      self.last_update_angle = sprite.angle
      self.last_updated_at = args.state.tick_count
    end

    move
    turn(args: args)

    self
  end

  def chasing_player?
    chasing_player == true
  end

  def chasing_player!(tile)
    return # TURNED OFF FOR NOW
    self.chasing_player = true

    if self.player_last_spotted != tile
      self.player_last_spotted = tile
      build_new_chase_track(destination: tile)
    end
  end

  private

  def current_track
    return track

    if chasing_player?
      chase_track
    else
      track
    end
  end

  def build_new_chase_track(destination)
    PointsPath.new(destination: destination, from: sprite.origin_point)
  end

  def move
    self.sprite.origin_point = next_point
  end

  def next_point
    sprite.origin_point + (Vector.build(direction) / TICKS_PER_TILE)
  end

  def turn(args:)
    ps = Vector.build(track.previous_step)
    cs = Vector.build(track.current_step)
    ns = Vector.build(track.next_step)

    v = Vector.new(x: cs.x - ps.x, y: cs.y - ps.y).normalize
    t = Vector.new(x: v.y, y: -v.x)

    origin = cs
    vt = (t - origin).normalize
    vns = (ns - origin).normalize

    angle = (t.x * vns.x) + (t.y * vns.y)
    torque = 45 / TICKS_PER_TILE

    if angle == 0.0
      sprite.angle = step_angle - 90
    elsif angle > 0.0
     sprite.angle -= torque
    elsif angle < 0.0
      sprite.angle += torque
    end
  end

  def step_angle
    $geometry.angle_to track.current_step, track.next_step
  end

  def direction_from_position(destination)
    direction_x = (track.next_step[:x] - sprite.origin_point.x)
    direction_y = (track.next_step[:y] - sprite.origin_point.y)

    Vector.new(x: direction_x, y: direction_y) # .normalize
  end

  def sprint_speed
    step_speed * SPRINT_MULTIPLIER
  end

  def step_speed
    TileBoard::TILE_SIZE / TICKS_PER_TILE
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
        buffer = 0.9
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