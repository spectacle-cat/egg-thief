class RoadrunnerTrack
  attr_reader :args, :track
  attr_accessor :points, :steps, :position, :from_step, :last_stepped_at

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  # one tile per X ticks
  SPEED = 30
  # SPEED = 75

  def initialize(args, track)
    @args = args
    @track = track
    @steps = build_track
    @from_step = steps[0]
    @position = @from_step
    @last_stepped_at = 0
    @last_up_was_zero = true
  end

  def tick
    if args.tick_count % SPEED == 0
      self.last_stepped_at = args.tick_count
      increment_step
    end

    step = from_step.dup
    nstep = next_step(step)
    pstep = previous_step(steps, step)

    current_progress = args.easing.ease(
      last_stepped_at,
      args.state.tick_count,
      SPEED,
      step[:corner] ? :quad : :identity
    )

    case step[:direction]
    when :up
      step[:y] += (nstep[:y] - step[:y]) * current_progress
    when :down
      step[:y] -= (step[:y] - nstep[:y]) * current_progress
    when :right
      step[:x] += (nstep[:x] - step[:x]) * current_progress
    when :left
      begin
      step[:x] -= (step[:x] - nstep[:x]) * current_progress
      rescue
        raise "issue with left direction - sx: #{step[:x]} nx: #{nstep[:x]} progress: #{current_progress} (step #{step} nstep: #{nstep})"
      end
    else
      raise "no direction"
    end

    if step[:angle] == 90 && pstep[:angle] == 360
      step[:angle] = 0
    end
    if step[:angle] == 360 && nstep[:angle] == 90
      step[:angle] = 0
    end

    step[:angle] = increment_angle(step[:angle], nstep[:angle], current_progress)

    self.position = step
    args.outputs.debug << [200, 100, "Angle: #{step[:angle]}"].label
    args.outputs.debug << [200, 50, "Direction: #{step[:direction]}"].label
    args.outputs.debug << [200, 75, "Row: #{step[:row]} - Column: #{step[:column]}"].label

    # steps.each { |step| args.outputs.debug << step.border }

    steps.each do |i|
      stepb = next_step(i)
      args.outputs.debug << [i[:x], i[:y], stepb[:x], stepb[:y], 200, 200, 0].line
    end
    args.outputs.debug << [step[:x], step[:y], nstep[:x], nstep[:y], 0, 200, 0].line


    self
  end

  def increment_angle(angle, next_angle, delta)
    r = if angle > next_angle
      angle - ((angle - next_angle) * delta)
    elsif angle < next_angle
      angle + ((next_angle - angle) * delta)
    else
      angle
    end
    r
  end

  def increment_step
    if args.tick_count % SPEED == 0
      ns = next_step(from_step)
      self.from_step = ns
    end
  end

  def next_step(step)
      i = step[:index]
      puts "last index: #{steps.last[:index]}"
      ni = if i == (steps.last[:index])
        puts "last"
        1
      else
        puts "not last (#{i})"
        i + 1
      end

      r = steps[ni - 1]
      raise "no next step #{step} - i: #{i} ni: #{ni} steps count: #{steps.count} - 1 r: #{r}" unless r
      r
    # rescue => e
    #   raise "issue with next step #{step} - i: #{i} ni: #{ni} steps count: #{steps.count} - 1, #{e}"
  end

  def previous_step(steps, step)
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
    # r =
    # r = add_extra_steps_on_corners(
      r = calculate_angles(
        add_corners_to_steps(
         add_steps_between_points))
    # )

    # r.each {|i| puts i.slice(:angle, :direction).inspect }
    # raise
    r
  end

  def calculate_angles(steps)
    rotations = 0
    steps.each.with_index do |step, i|
      if i == 0
        prev_step = steps.last
        next_step = steps[1]
      elsif i == (steps.count - 1)
        prev_step = steps[steps.count - 2]
        next_step = steps.first
      else
        prev_step = steps[i - 1]
        next_step = steps[i + 1]
      end

      prev_angle = prev_step[:angle]
      angle = Common::Direction.angle(step[:direction])
      next_angle = next_step[:angle]

      if prev_angle != angle && next_angle != angle
      elsif prev_angle == angle && next_angle != angle
      elsif prev_angle != angle && next_angle == angle
      elsif prev_angle == angle && next_angle == angle
      end

      if next_angle == 270 && angle == 0
        angle = 360
      end

      if prev_angle == 360 && angle == 0
        angle = 360
      end

      if prev_angle == 270 && angle == 0
        angle = 360
      end

      step[:angle] = angle
    end
  end

  def add_extra_steps_on_corners(steps)
    acc = []
    steps.each do |step|
      acc << step
      next unless step[:corner]

      pd = step[:previous_direction]
      d = step[:direction]
      nd = step[:next_direction]
      tile = TileBoard::TILE_SIZE

      new_steps =
        case [d, nd]
        when [:up, :right]

        when [:up, :left]
          [
            # { x: step[:x] - (tile * 0.9), y: step[:y] + (tile * 0.5) },
            { x: step[:x] + (tile * 0.7), y: step[:y] + (tile * 0.7) },
            # { x: step[:x] - (tile * 0.25), y: step[:y] + (tile * 0.9) },
          ]
        when [:down, :right]
        when [:down, :left]
        when [:left, :up]
        when [:left, :down]
        when [:right, :up]
        when [:right, :down]
        else
          raise "shouldnt get here, corners are not properly specified for: #{pd} -> #{d} -> #{nd}"
        end
      acc << new_steps.map { |new_step| step.dup.merge(**new_step) } if new_steps
    end

    acc.flatten!

    index = 1
    acc.flatten.each do |item|
      item[:index] = index
      index += 1
    end

    # acc.each do |a|
    #   begin
    #   puts a.slice(:index, :x, :y, :angle, :corner).inspect
    #   rescue
    #     raise "problem with #{a}"
    #   end
    # end
    # raise

    acc
  end

  def add_corners_to_steps(steps)
    steps.each.with_index do |step, i|
      nstep =
        if i == (steps.count - 1)
          steps[0]
        else
          steps[i + 1]
        end
      pstep = previous_step(steps, step)

      step[:corner] = nstep[:direction] != step[:direction]
      step[:next_direction] = nstep[:direction]
      step[:previous_direction] = pstep[:direction]
    end

    # steps.map { |step| puts step.slice(:corner, :direction, :next_direction) }.inspect
    # raise

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
          x: tile[:x] + (TileBoard::TILE_SIZE / 2),
          y: tile[:y] + (TileBoard::TILE_SIZE / 2),
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