class TrackingEntity
  attr_reader :track
  attr_accessor :sprite, :speed, :direction, :sprint,
  :last_update_angle, :last_updated_at, :level_attributes,
  :offscreen, :loaded_at

  TICKS_PER_TILE = 20
  SPRINT_MULTIPLIER = 2

  def initialize(track:, sprite: , attributes: {})
    @level_attributes = default_attributes.merge(attributes)
    @sprint = false
    @speed = step_speed
    @track = track
    step = track.current_step.dup
    @sprite = sprite.new(origin_point: Vector.build(step), angle: step[:angle])
    @last_update_angle = step[:angle]
    @last_updated_at = 0
    @loaded_at = 0

    @direction = direction_from_position
    @offscreen = false
  end

  def reset!
    current_track.reset!

    self.sprint = false
    self.speed = step_speed

    step = track.current_step.dup
    sprite.origin_point = Vector.build(step)
    sprite.angle = step[:angle]

    @last_update_angle = step[:angle]

    @direction = direction_from_position
    @offscreen = false
  end

  def tick(args)
    self.loaded_at = args.state.tick_count if loaded_at == 0

    if start_delay_time > 0
      return self if args.state.tick_count < (loaded_at + start_delay_time)
    end

    if offscreen
      return self if args.state.tick_count < (self.last_updated_at + offscreen_time)
    end

    if offscreen
      self.offscreen = false
      reset!
    end

    if args.tick_count % speed == 0
      current_track.update!
      self.last_updated_at = args.state.tick_count

      if current_track.next_step.nil?
        self.offscreen = true
        return self
      else
        self.speed = sprint ? sprint_speed : step_speed
        self.direction = direction_from_position
        self.last_update_angle = sprite.angle
      end
    end

    move
    turn(args: args)

    self
  end

  def sighted_enemy!
    self.sprint = true if level_attributes[:chase_player] == "true"
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
    (level_attributes["speed"] || TICKS_PER_TILE).to_i
  end

  def sprint_speed
    step_speed / SPRINT_MULTIPLIER
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

    if track.current_step
      args.outputs.debug << [
        track.current_step[:x], track.current_step[:y],
        sprite.origin_point.x, sprite.origin_point.y, 0, 200, 250
      ].line
    end

    # args.outputs.debug << [
    #   sprite.origin_point.x, sprite.origin_point.y,
    #   direction.x, direction.y, 0, 0, 0
    # ].line

    args.outputs.debug << [100, 50, "offscreen: #{offscreen}"].label
  end

  def offscreen_time
    level_attributes["seconds_between_flights"].to_i * 60
  end

  def start_delay_time
    level_attributes["start_delay"].to_i * 60
  end

  def default_attributes
    {
      "speed" => speed,
      "chase_player" => "false",
      "start_delay" => 0
     }
  end
end