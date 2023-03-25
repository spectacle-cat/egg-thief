class PointsPath
  attr_reader :destination, :from, :candidate_tiles
  attr_accessor :args

  def initialize(destination: , from: , candidate_tiles:, args:)
    @destination = destination
    @from = from
    @candidate_tiles = candidate_tiles
    @args = args
  end

  # have a starting point
  # find the neighbours
    # exclude empty
    # next if already visited
    # record where we came from for each neighbour
    # are we are then desintation?
      # Yes -> break
      # No -> find the next set of neighbours
  # [
  #   { came_from: Point, step_count: Integer, tile: Tile, at_destination: Bool },
  # ]

  def build
    destination_found = false
    potential_tiles = candidate_tiles.map { |tile| tile.merge(visited: false) }

    destination_tile = nil

    frontiers = [destination[:fov_col].abs, destination[:fov_row].abs].max

    frontiers.times do |frontier|
      frontier_tiles(frontier, potential_tiles).each do |ft|
        args.outputs.debug << ft.merge(r: 0, g: 200, b: 200).solid

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
            break(neighbour)
          else
            args.outputs.debug << neighbour.merge(r: 0, g: 170, b: 170, a: 150).solid
          end
        end
      end

      # puts "pts: #{potential_tiles}"
      # puts "nts: #{neighbouring_tiles}"
    end

    # while (!destination_tile && potential_tiles.any?) do
    #   frontier_tiles(frontier).each do |origin_tile|
    #     next if destination_found

    #     neighbours(origin_tile).each do |neighbour|
    #       next if destination_found
    #       next if neighbour[:visited]
    #       potential_tiles.delete(neighbour)

    #       neighbour[:visited] = true
    #       neighbour[:came_from] = origin_tile
    #       neighbour[:path_index] = frontier

    #       destination_found = neighbour[:fov_col] == destination[:fov_col] &&
    #         neighbour[:fov_row] == destination[:fov_row]

    #       if destination_found
    #         neighbour[:destination] = true
    #         destination_tile = neighbour
    #       end
    #     end
    #   end

    #   frontier += 1
    # end

    # loop through came_from tiles to get the path!
    destination_tile
    [from, destination]
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

    top + left + right + bottom
  end
end