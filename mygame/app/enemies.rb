module Enemies
  extend self

  def setup(args)
    enemies = args.state.level_data.except("tiles")

    enemies.each do |(enemy_type, tracks)|
      case enemy_type
      when "Roadrunner"
        args.state.enemies.roadrunner_tracks ||= []

        tracks.each do |track|
          args.state.enemies.roadrunner_tracks <<
            RoadrunnerTrack.new(args, tracks).build_track
        end
      end
    end
  end
end