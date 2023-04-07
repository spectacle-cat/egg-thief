class TrackBuilder
  attr_reader :args, :track
  attr_accessor :points, :steps

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  def initialize(args, track)
    @args = args
    @track = track
    @steps = []
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

  def prev_step(step)
    i = step[:index]
    ni = if i == (steps.first[:index])
      steps.last[:index]
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

  def build_track(loops: true)
    build_points

    add_facing_angles_to_points
    add_distance_to_points

    result = add_steps_between_points(loops: loops)
    result = extend_steps(result) unless loops

    result =
      reindex_coll(
        make_corners_45_degrees(
          calculate_angles(
            add_corners_to_steps(
              result
            )
          )
        )
      )

    if loops
      TrackLoop.new(result)
    else
      SingleTrack.new(result)
    end
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
      pstep = previous_step(steps, step)
      nstep = next_step_in(steps, step, index: i)

      if step[:direction] == step[:previous_direction] # && nstep[:corner] != true
        acc << step
        next
      end

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

      acc << step.dup.merge(p_override).merge(corner_angle: true, angle: pstep[:angle] - 45)
      acc << step.dup.merge(n_override)
    end

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

    steps
  end

  def add_steps_between_points(loops: true)
    steps = []

    points.each.with_index do |point, index|
      next if !loops && (index + 1) == points.count

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
      next if point[:tile_distance]

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
          offscreen: false,
        }
      end
    end

    @points = @points.sort_by { |point| point[:index] }
  end

  def extend_steps(coll)
    first_point = coll[0]
    second_point = coll[1]

    v1 = Vector.build(x: first_point[:x], y: first_point[:y])
    v2 = Vector.build(x: second_point[:x], y: second_point[:y])
    v3 = v1 + (v1 - v2)

    offset = TileBoard::TILE_SIZE * 2
    x = first_point[:x]
    if v1.x != v3.x
      x = v3.x > v1.x ? (x + offset) : (x - offset)
    end

    y = first_point[:y]
    if v1.y != v3.y
      y = v3.y > v1.y ? (y + offset) : (y - offset)
    end

    beginning_point = first_point.dup.merge({
      x: x,
      y: y,
      offscreen: true,
      tile_distance: 1,
    })
    coll.unshift(beginning_point)

    penultimate, last_point = coll.last(2)

    v1 = Vector.build(x: last_point[:x], y: last_point[:y])
    v2 = Vector.build(x: penultimate[:x], y: penultimate[:y])
    v3 = v1 + (v1 - v2)

    offset = TileBoard::TILE_SIZE * 2
    x = last_point[:x]
    if v1.x != v3.x
      x = v3.x > v1.x ? (x + offset) : (x - offset)
    end

    y = last_point[:y]
    if v1.y != v3.y
      y = v3.y > v1.y ? (y + offset) : (y - offset)
    end

    ending_point = last_point.dup.merge({
      x: x,
      y: y,
      offscreen: true,
      tile_distance: 1,
    })

    coll.push(ending_point)

    coll
  end

  def inspect
    serialize.to_s
  end

  def serialize
    {
      track: track,
      steps: steps
    }
  end
end