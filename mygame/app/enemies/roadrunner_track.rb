class RoadrunnerTrack
  attr_reader :args, :track
  attr_accessor :points, :steps, :position, :from_step, :last_stepped_at

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  # one tile per X ticks
  SPEED = 60
  # SPEED = 1000

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
    step = from_step.dup
    nstep = next_step(step)

    pixels_per_frame = 6
    step_distance = $geometry.distance(step, nstep)
    distance = $geometry.distance(step, self.position) + pixels_per_frame

    if distance >= (step_distance * 0.6)
      self.last_stepped_at = args.tick_count
      self.from_step = step = next_step(from_step).dup
      nstep = next_step(step)
      self.from_step = step
    end

    current_progress = args.easing.ease(
      last_stepped_at,
      args.state.tick_count,
      pixels_per_frame * 60,
      :identity
    )

    direction_x = (nstep[:x] - self.position[:x])
    direction_y = (nstep[:y] - self.position[:y])

    nx, ny = normalize(direction_x, direction_y)

    distance_x = nx * pixels_per_frame
    distance_y = ny * pixels_per_frame

    step[:x] = self.position[:x] + distance_x
    step[:y] = self.position[:y] + distance_y

    step[:angle] = (($geometry.angle_to self.position, nstep) - 90)

    self.position = step
    # args.outputs.debug << [200, 100, "Angle: #{step[:angle]} - Next Angle: #{nstep[:angle]}"].label
    args.outputs.debug << [200, 75, "X: #{step[:x]} - y: #{step[:y]} - Distance: #{distance}"].label
    # args.outputs.debug << [200, 50, "Direction: #{step[:direction]} - Next Direction: #{nstep[:direction]}"].label
    args.outputs.debug << [200, 50, "XDirection: #{direction_x} - YDirection: #{direction_y}"].label

    # steps.each { |step| args.outputs.debug << step.border }

    steps.each do |i|
      stepb = next_step(i)
      args.outputs.debug <<
      if i[:corner_angle] == true
         [i[:x], i[:y], stepb[:x], stepb[:y], 0, 150, 250].line
      else
         [i[:x], i[:y], stepb[:x], stepb[:y], 200, 200, 0].line
      end
    end
    args.outputs.debug << [step[:x], step[:y], nstep[:x], nstep[:y], 0, 200, 0].line


    self
  end

  #return the magnitude of the vector
  def mag(x, y)
    ((x**2)+(y**2))**0.5
  end

  #returns a new normalize version of the vector
  def normalize(x, y)
    [x/mag(x, y), y/mag(x, y)]
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

  def next_step(step)
    i = step[:index]
    ni = if i == (steps.last[:index])
      1
    else
      i + 1
    end

    steps[ni - 1]
  end

  def next_step_in(coll, step, index: nil)
    i = (index || step[:index]) - 1
    if i == (coll.count - 1)
      coll[0]
    else
      coll[i + 1]
    end
  end

  def previous_step(coll, step)
    i = coll.index(step)

    if i == (coll.count - 1)
      coll.last
    else
      coll[i - 1]
    end
  end

  def build_track
    build_points
    add_facing_angles_to_points
    add_distance_to_points
    # r =
    reindex_coll(
      calculate_angles(
        make_corners_45_degrees(
          add_corners_to_steps(
            add_steps_between_points))))

    # r.each {|i| puts i.slice(:angle, :direction).inspect }
    # raise
    # r
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

  def reindex_coll(coll)
    index = 1
    coll.flatten.each do |item|
      item[:index] = index
      index += 1
    end
  end

  def make_corners_45_degrees(steps)
    acc = []
    steps.each.with_index do |step, i|
      if step[:direction] == step[:previous_direction]
        acc << step
        next
      end

      pstep = previous_step(steps, step)
      nstep = next_step_in(steps, step, index: i)

      offset = TileBoard::TILE_SIZE / 2

      p_override = case pstep[:direction]
      when :up
        { y: pstep[:y] + offset }
      when :right
        { x: pstep[:x] + offset }
      when :left
        { x: pstep[:x] - offset }
      when :down
        { y: pstep[:y] - offset }
      end

      n_override = case nstep[:direction]
      when :up
        { y: nstep[:y] + offset }
      when :right
        { x: nstep[:x] + offset }
      when :left
        { x: nstep[:x] - offset }
      when :down
        { y: nstep[:y] - offset }
      end

      puts acc << step.dup.merge(p_override).merge(corner_angle: true)
      puts acc << step.dup.merge(n_override).merge(corner_angle: true)
      # raise
    end

    # acc.each { |a| puts a.slice(:x, :y, :corner_angle, :corner, :previous_direction, :direction, :next_direction).inspect }
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