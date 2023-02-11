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
            track = RoadrunnerTrack.new(args, track)
            track.build_track
            track
        end
      end
    end
  end

  def tick(args)
    sprites = []

    args.state.enemies.roadrunner_tracks.each do |track|
      r = Roadrunner.new(track.tick.position)
      # args.outputs.debug << [r.x, r.y, r.h, r.w].border
      sprites << r
    end

    args.outputs.sprites << sprites
  end
end