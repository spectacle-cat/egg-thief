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

    frontiers.times do |frontier|
      next if destination_found

      frontier_tiles(frontier, potential_tiles).sort_by do |tile|
          proximity_to_destination(x: tile[:x], y: tile[:y])
      end.each do |ft|
        # args.outputs.debug << ft.merge(r: 0, g: 90, b: 200, a: 100).solid

        absolute_neighbours = relative_neighbours(1).map do |(x, y)|
          row = ft[:row] + x
          col = ft[:column] + y

          potential_tiles.find { |pt| pt[:row] == row && pt[:column] == col }
        end.compact

        neighbours = absolute_neighbours.sort_by do |tile|
          proximity_to_destination(x: tile[:x], y: tile[:y])
        end

        neighbours.each do |neighbour|
          next if destination_found
          next if neighbour[:visited]
          neighbour[:visited] = true

          neighbour[:came_from] = ft
          neighbour[:path_index] = frontier

          destination_found = neighbour[:fov_col] == destination[:fov_col] &&
          neighbour[:fov_row] == destination[:fov_row]

          if destination_found
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

    # [
    #   [frontier, frontier],
    #   [-frontier, frontier],
    #   [frontier, -frontier],
    #   [-frontier, -frontier],
    # ]
  end

  def proximity_to_destination(x:, y:)
    p_vector = Vector.new(x: x, y: y)
    d_vector = destination_vector

    $geometry.distance(d_vector, p_vector)

    # distance_x = (d_vector.x - p_vector.x).abs
    # distance_y = (d_vector.y - p_vector.y).abs

    # if distance_x > distance_y
    #   distance_x
    # else
    #   distance_y
    # end
  end

  def destination_vector
    @destination_vector ||= Vector.new(x: destination[:x], y: destination[:y])
  end
end