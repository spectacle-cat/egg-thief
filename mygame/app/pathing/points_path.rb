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
    potential_tiles = candidate_tiles.map { |tile| tile.merge(visited: false) }

    destination_tile = nil
    routes = []

    frontiers = [destination[:fov_col].abs, destination[:fov_row].abs].max

    frontiers.times do |frontier|
      next if destination_found

      frontier_tiles(frontier, potential_tiles).each do |ft|
        # args.outputs.debug << ft.merge(r: 0, g: 90, b: 200, a: 100).solid

        absolute_neighbours = relative_neighbours(1).map do |(x, y)|
          [ft[:row] + x, ft[:column] + y]
        end

        neighbouring_tiles = absolute_neighbours.map do |(row, col)|
          neighbour = potential_tiles.find { |pt| pt[:row] == row && pt[:column] == col }

          next unless neighbour
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
            break
          else
            # args.outputs.debug << neighbour.merge(r: 0, g: 170, b: 170, a: 150).solid
          end
        end
      end
    end

    path = []
    i = destination_tile
    while [i[:fov_col], i[:fov_row]] != [0,0]  do
      path << i
      i = i[:came_from]
    end
    path << from

    path
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
end