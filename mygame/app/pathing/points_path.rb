class PointsPath
  attr_reader :destination, :from, :candidate_tiles
  attr_accessor :args

  def initialize(destination: , from: , candidate_tiles:, args:)
    @destination = destination
    @from = from
    @candidate_tiles = candidate_tiles
    @args = args
  end

  def build
    destination_found = false
    potential_tiles = candidate_tiles.uniq.map { |tile| tile.merge(visited: false) }

    destination_tile = nil
    routes = []

    frontiers = [destination[:fov_col].abs, destination[:fov_row].abs].max

    max_attempts = 30
    attempts = 0
    closest_to_start = nil

    (frontiers + 1).times do |frontier|
      next if destination_found

      frontier_tiles(frontier, potential_tiles).sort_by do |tile|
          proximity_to_destination(x: tile[:x], y: tile[:y])
      end.each do |ft|
        absolute_neighbours = relative_neighbours(1).map do |(x, y)|
          row = ft[:row] + x
          col = ft[:column] + y

          potential_tiles.find { |pt| pt[:row] == row && pt[:column] == col }
        end.compact

        neighbours = absolute_neighbours.sort_by do |tile|
          proximity_to_destination(x: tile[:x], y: tile[:y])
        end

        neighbours.each do |neighbour|
          next if destination_found && frontier != 0
          next if neighbour[:visited]

          neighbour[:visited] = true
          neighbour[:came_from] = ft
          neighbour[:path_index] = frontier

          if frontier == 0
            distance = proximity_to_start(x: neighbour[:x], y: neighbour[:y])

            if distance % 100 == 0 # not a diagonal
              closest_to_start = neighbour unless closest_to_start

              closest_to_start = neighbour if distance < proximity_to_start(x: closest_to_start[:x], y: closest_to_start[:y])
            end
          end

          destination_found = neighbour[:fov_col] == destination[:fov_col] &&
          neighbour[:fov_row] == destination[:fov_row]

          if destination_found && frontier != 0
            neighbour[:destination] = true
            destination_tile = neighbour

            args.outputs.debug << neighbour.merge(r: 200, g: 250, b: 0).solid

            path = []
            i = neighbour
            short_circuit = 20
            circuit_count = 0
            while [i[:fov_col], i[:fov_row]] != [0,0]  do
              circuit_count += 1
              path << i
              i = i[:came_from]

              break if i.nil?
              break if circuit_count >= short_circuit
            end
            path << from
            routes << path

            break
          else
            # args.outputs.debug << neighbour.merge(r: 0, g: 170, b: 170, a: 150).solid
          end

          attempts += 1
          break if attempts >= max_attempts
        end
      end
    end

    if attempts >= max_attempts
      puts "routes: #{routes.count}"
      puts "attempts: #{attempts}"
      raise
    end

    routes.uniq!
    if routes.count > 3
      puts "routes: #{routes.count}"
      routes.each do |route|
        puts route.map { |r| [r[:fov_col], r[:fov_row]] }
      end
      raise
    end

    shortest_route = routes.sort { |r| r.count }.last

    if shortest_route && closest_to_start && !shortest_route.include?(closest_to_start)
      shortest_route.pop
      shortest_route =  shortest_route + [closest_to_start, from]
    end

    (shortest_route || [from, destination])
  end

  def frontier_tiles(frontier, tiles)
    frontier_coords = relative_neighbours(frontier)

    tiles.select do |tile|
      frontier_coords.find { |(x, y)| tile[:fov_col] == y && tile[:fov_row] == x }
    end
  end

  def relative_neighbours(frontier)
    top = (-frontier).upto(frontier).map { |x| [x, frontier]  }
    left = (-frontier).upto(frontier).map { |y| [(-frontier), y]  }
    right = (-frontier).upto(frontier).map { |y| [frontier, y]  }
    bottom = (-frontier).upto(frontier).map { |x| [x, (-frontier)]  }

    points = top + left + right + bottom
    points.uniq
  end

  def proximity_to_destination(x:, y:)
    p_vector = Vector.new(x: x, y: y)
    d_vector = destination_vector

    $geometry.distance(d_vector, p_vector)
  end

  def proximity_to_start(x:, y:)
    p_vector = Vector.new(x: x, y: y)
    s_vector = start_vector

    $geometry.distance(s_vector, p_vector)
  end

  def destination_vector
    @destination_vector ||= Vector.new(x: destination[:x], y: destination[:y])
  end

  def start_vector
    @start_vector ||= Vector.new(x: from[:x], y: from[:y])
  end
end