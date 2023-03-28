module Enemies
  extend self

  def setup(args)
    enemies = args.state.level_data.except("Tiles")

    enemies.each do |(enemy_type, level_data)|
      case enemy_type
      when "Roadrunner"
        args.state.enemies.roadrunners ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track
          entity = TrackingEntity.new(track: TrackLoop.new(track), sprite: Enemies::Roadrunner)
          args.state.enemies.roadrunners << entity
        end
      when "Hawk"
        args.state.enemies.hawks ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track
          entity = TrackingEntity.new(track: TrackLoop.new(track), sprite: Enemies::Hawk)
          args.state.enemies.hawks << entity
        end
      when "Owl"
        args.state.enemies.owls ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track
          entity = TrackingEntity.new(track: TrackLoop.new(track), sprite: Enemies::Owl)
          args.state.enemies.owls << entity
        end
      end
    end
  end

  def tick(args)
    sprites = []

    args.state.enemies.roadrunners.each do |entity|
      sprites << entity.tick(args).sprite

      # entity.current_track.show_debug(args)
      # entity.show_debug(args)
    end

    args.state.enemies.hawks.each do |entity|
      sprites << entity.tick(args).sprite

      # entity.current_track.show_debug(args)
      # entity.show_debug(args)
    end

    args.state.enemies.owls.each do |entity|
      sprites << entity.tick(args).sprite

      # entity.current_track.show_debug(args)
      # entity.show_debug(args)
    end

    args.outputs.sprites << sprites
  end
end