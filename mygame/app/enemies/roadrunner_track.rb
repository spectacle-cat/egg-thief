class RoadrunnerTrack
  attr_reader :args, :track
  attr_accessor :points, :position, :from_point, :next_point

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  # one tile per X ticks
  SPEED = 60

  def initialize(args, track)
    @args = args
    @track = track.first
    @points = build_track
    @from_point = points[0]
    @position = @from_point
  end

  def tick
    next_position
    self
  end

  def next_position
    if args.tick_count % SPEED == 0
      np = next_point(from_point)
      puts "next point: #{np}"
      self.from_point = np
      puts "from_point: #{from_point}"
      self.position = from_point
      puts "position: #{position}"
    end
  end

  def next_point(point)
    i = point.index

    if i == (points.count - 1)
      points[0]
    else
      points[i + 1]
    end
  end

  def build_track
    build_points
    add_facing_angles_to_points
    add_distance_to_points
    points
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
        puts "point: #{point}"
        puts "next point: #{next_point}"
        puts "i: #{i}"
        puts "count: #{points.count}"
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
        puts "point: #{point}"
        puts "next point: #{next_point}"
        puts "i: #{i}"
        puts "count: #{points.count}"
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
    points = []

    0.upto(7 - 1) do |row|
      0.upto(12 - 1) do |col|
        char = track[row][col]

        next unless ALPHABET.include?(char)

        tile = args.state.tiles.find do |tile|
          tile[:row] == row && tile[:column] == col
        end

        points << {
          x: tile[:x],
          y: tile[:y],
          h: 100,
          w: 100,
          row: row,
          column: col,
          index: ALPHABET.index(char),
        }
      end
    end

    @points = points.sort_by { |point| point[:index] }
  end
end