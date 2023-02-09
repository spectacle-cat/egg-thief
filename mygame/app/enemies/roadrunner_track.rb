class RoadrunnerTrack
  attr_reader :args, :track, :points

  ALPHABET = %w[a b c d e f g h i j k l m n o p q r s t u v w x y z]

  def initialize(args, track)
    @args = args
    @track = track.first
    @points = build_points
  end

  def build_track
    args.state.enemy_tracks = points

    # sort the points by the alphabet
    # calculate the facing angle
    # calculate the distance to travel
    # need a class to work out the travelling per tick
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

    points.sort_by { |point| point[:index] }
  end
end