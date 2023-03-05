module Enemies
  extend self

  def setup(args)
    enemies = args.state.level_data.except("tiles")

    enemies.each do |(enemy_type, tracks)|
      case enemy_type
      when "Roadrunner"
        args.state.enemies.roadrunners ||= []
        tracks.each do |track|
          track = TrackBuilder.new(args, track).build_track
          entity = TrackingEntity.new(track: TrackLoop.new(track), sprite: Roadrunner)
          args.state.enemies.roadrunners << entity
        end
      end
    end
  end

  def tick(args)
    sprites = []

    args.state.enemies.roadrunners.each do |entity|
      sprites << entity.tick(args).sprite

      # entity.track.show_debug(args)
      # entity.show_debug(args)
    end

    args.outputs.sprites << sprites
  end
end