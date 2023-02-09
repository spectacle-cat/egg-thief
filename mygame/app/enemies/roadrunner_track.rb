class RoadrunnerTrack
  attr_reader :args, :track
  attr_accessor :points, :steps, :position, :from_step, :last_stepped_at

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  # one tile per X ticks
  SPEED = 25

  def initialize(args, track)
    @args = args
    @track = track
    @steps = build_track
    @from_step = steps[0]
    @position = @from_step
    @last_stepped_at = 0
  end

  def tick
    if args.tick_count % SPEED == 0
      self.last_stepped_at = args.tick_count
      increment_step
    end

    current_progress = args.easing.ease(
      last_stepped_at,
      args.state.tick_count,
      SPEED,
      :identity
    )

    step = from_step.dup
    nstep = next_step(step)

    case step[:direction]
    when :up
      step[:y] += (nstep[:y] - step[:y]) * current_progress
    when :down
      step[:y] -= (step[:y] - nstep[:y]) * current_progress
    when :right
      step[:x] += (nstep[:x] - step[:x]) * current_progress
    when :left
      step[:x] -= (step[:x] - nstep[:x]) * current_progress
    else
      raise "no direction"
    end

    step[:angle] = Common::Direction.angle(step[:direction])

    self.position = step

    self
  end

  def increment_step
    if args.tick_count % SPEED == 0
      ns = next_step(from_step)
      self.from_step = ns
    end
  end

  def next_step(step)
    i = steps.index(step)

    if i == (steps.count - 1)
      steps[0]
    else
      steps[i + 1]
    end
  end

  def previous_step(step)
    i = steps.index(step)

    if i == (steps.count - 1)
      steps.last
    else
      steps[i - 1]
    end
  end

  def build_track
    build_points
    add_facing_angles_to_points
    add_distance_to_points
    add_corners_to_steps(add_steps_between_points)
  end

  def add_corners_to_steps(steps)
    steps.each.with_index do |step, i|
      nstep =
        if i == (steps.count - 1)
          steps[0]
        else
          steps[i + 1]
        end


      step[:corner] = nstep[:direction] != step[:direction]
    end

    steps
  end

  def add_steps_between_points
    steps = []

    points.each do |point|
      point[:tile_distance].abs.times do |n|
        step = point.dup

        case point[:direction]
        when :up
          step[:y] += (n * step[:h])
        when :down
          step[:y] -= (n * step[:h])
        when :right
          step[:x] += (n * step[:w])
        when :left
          step[:x] -= (n * step[:w])
        else
          raise "no direction"
        end

        step[:index] = steps.count + 1

        steps << step
      end
    end

    steps
  end

  def add_distance_to_points
    0.upto(points.count - 1).each do |i|
      point = points[i]
      next_point =
        if i == (points.count - 1)
          points[0]
        else
          points[i + 1]
        end

      if point.nil? || next_point.nil?
        raise "missing point"
      end

      tile_distance =
        if point[:row] == next_point[:row]
          if point[:column] > next_point[:column]
            -(point[:column] - next_point[:column])
          else
            next_point[:column] - point[:column]
          end
        else
          if point[:row] > next_point[:row]
            -(point[:row] - next_point[:row])
          else
            -(point[:row] - next_point[:row])
          end
        end

      point[:tile_distance] = tile_distance
    end
  end

  def add_facing_angles_to_points
    0.upto(points.count - 1).each do |i|
      point = points[i]
      next_point =
        if i == (points.count - 1)
          points[0]
        else
          points[i + 1]
        end

      if point.nil? || next_point.nil?
        raise "missing point"
      end

      direction =
        if point[:row] == next_point[:row]
          if point[:column] > next_point[:column]
            :left
          else
            :right
          end
        else
          if point[:row] > next_point[:row]
            :down
          else
            :up
          end
        end

      point[:direction] = direction
    end
  end

  def build_points
    @points = []

    0.upto(7 - 1) do |row|
      0.upto(12 - 1) do |col|
        char = track[row][col]

        next unless ALPHABET.include?(char)

        tile = args.state.tiles.find do |tile|
          tile[:row] == row && tile[:column] == col
        end

        @points << {
          h: 100,
          w: 100,
          x: tile[:x],
          y: tile[:y],
          row: row,
          column: col,
          index: ALPHABET.index(char),
        }
      end
    end

    @points = @points.sort_by { |point| point[:index] }
  end

  def inspect
    serialize.to_s
  end

  def serialize
    {
      position: position,
      from_step: from_step,
      last_stepped_at: last_stepped_at
    }
  end
end