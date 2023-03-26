class TrackingEntity
  attr_reader :track
  attr_accessor :sprite, :speed, :direction, :sprint,
  :last_update_angle, :last_updated_at

  TICKS_PER_TILE = 20
  SPRINT_MULTIPLIER = 2

  def initialize(track:, sprite: )
    @sprint = false
    @speed = step_speed

    @track = track
    @chase_track = nil
    step = track.current_step.dup
    @sprite = sprite.new(origin_point: Vector.build(step), angle: step[:angle])
    @last_update_angle = step[:angle]
    @last_updated_at = 0

    @direction = direction_from_position
  end

  def tick(args)
    if args.tick_count % speed == 0
      current_track.update!

      self.speed = sprint ? sprint_speed : step_speed
      self.direction = direction_from_position
      self.last_update_angle = sprite.angle
      self.last_updated_at = args.state.tick_count
    end

    if current_track.next_step
      move
      turn(args: args)
    end

    self
  end

  def sighted_enemy!
    self.sprint = true
  end

  def idle_walk
    self.sprint = false
  end

  private

  def current_track
    track
  end

  def move
    self.sprite.origin_point = next_point
  end

  def next_point
    sprite.origin_point + (Vector.build(direction) / speed)
  end

  def turn(args:)
    ps = Vector.build(current_track.previous_step || current_track.current_step)
    cs = Vector.build(current_track.current_step)
    ns = Vector.build(current_track.next_step || current_track.current_step)

    v = Vector.new(x: cs.x - ps.x, y: cs.y - ps.y).normalize
    t = Vector.new(x: v.y, y: -v.x)

    origin = cs
    vt = (t - origin).normalize
    vns = (ns - origin).normalize

    angle = (t.x * vns.x) + (t.y * vns.y)
    torque = 45 / speed

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

  def direction_from_position
    return direction if current_track.next_step.nil?

    direction_x = (current_track.next_step[:x] - sprite.origin_point.x)
    direction_y = (current_track.next_step[:y] - sprite.origin_point.y)

    Vector.new(x: direction_x, y: direction_y) # .normalize
  end

  def step_speed
    TICKS_PER_TILE
  end

  def sprint_speed
    TICKS_PER_TILE / SPRINT_MULTIPLIER
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
    return unless args.state.debug

    args.outputs.debug << [
      track.current_step[:x], track.current_step[:y],
      sprite.origin_point.x, sprite.origin_point.y, 0, 200, 250
    ].line

    # args.outputs.debug << [
    #   sprite.origin_point.x, sprite.origin_point.y,
    #   direction.x, direction.y, 0, 0, 0
    # ].line
  end
end