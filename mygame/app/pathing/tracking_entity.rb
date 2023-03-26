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
    @direction = direction_from_position

    @chasing_player = false
    @player_last_spotted = nil
  end

  def reset
    self.chasing_player = false
    self.chase_track = nil
  end

  def tick(args)
    if args.tick_count % TICKS_PER_TILE == 0
      self.speed = step_speed # chasing_player? ? sprint_speed : step_speed

      current_track.update!

      if chasing_player && current_track.next_step == nil
        self.chasing_player = false
        self.chase_track = nil

        # Back to non-chase
        # current_track.update!
      end

      self.direction = direction_from_position

      self.last_update_angle = sprite.angle
      self.last_updated_at = args.state.tick_count
    end

    if current_track.next_step
      move
      turn(args: args)
    end

    chase_track.show_debug(args) if chase_track

    self
  end

  def chasing_player?
    chasing_player == true
  end

  def chasing_player!(chase_track: )
    self.chasing_player = true
    self.chase_track = chase_track
  end

  private

  def current_track
    if chasing_player?
      chase_track
    else
      track
    end
  end

  def move
    self.sprite.origin_point = next_point
  end

  def next_point
    sprite.origin_point + (Vector.build(direction) / TICKS_PER_TILE)
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

  def direction_from_position
    return direction if current_track.next_step.nil?

    direction_x = (current_track.next_step[:x] - sprite.origin_point.x)
    direction_y = (current_track.next_step[:y] - sprite.origin_point.y)

    Vector.new(x: direction_x, y: direction_y) # .normalize
  end

  def sprint_speed
    # step_speed * SPRINT_MULTIPLIER
    step_speed
  end

  def step_speed
    TileBoard::TILE_SIZE / TICKS_PER_TILE
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
    args.outputs.debug << [
      track.current_step[:x], track.current_step[:y],
      sprite.origin_point.x, sprite.origin_point.y, 0, 200, 250
    ].line

    # args.outputs.debug << [
    #   sprite.origin_point.x, sprite.origin_point.y,
    #   direction.x, direction.y, 0, 0, 0
    # ].line

    args.outputs.labels << [800, 125, "on_last_step? - #{current_track.on_last_step?}"]
    args.outputs.labels << [800, 100, "chasing player - #{chasing_player}"]

    args.outputs.labels << [600, 75, "direction - x: #{direction.x}, y: #{direction.y}"]
    args.outputs.labels << [600, 50, "next_point - x: #{next_point.x}, y: #{next_point.y}"]

    args.outputs.labels << [50, 100, "origin_point - x: #{sprite.origin_point.x}, y: #{sprite.origin_point.y}"]

    if current_track.next_step
      args.outputs.labels << [50, 75, "next_step - x: #{current_track.next_step[:x]}, y: #{current_track.next_step[:y]}"]
    else
      args.outputs.labels << [50, 75, "next_step - x:  , y:  "]
    end

    args.outputs.labels << [50, 50, "current_step - x: #{current_track.current_step[:x]}, y: #{current_track.current_step[:y]}"]

    if current_track.previous_step
      args.outputs.labels << [50, 25, "prev_step - x: #{current_track.previous_step[:x]}, y: #{current_track.previous_step[:y]}"]
    else
      args.outputs.labels << [50, 25, "prev_step - x:  , y:  "]
    end
  end
end