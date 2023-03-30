module Enemies
  extend self

  def setup(args)
    enemies = args.state.level_data.except("Tiles")

    enemies.each do |(enemy_type, level_data)|
      case enemy_type
      when "Roadrunner"
        args.state.enemies.roadrunners ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track(loops: level[:loop] == '0')
          entity = TrackingEntity.new(track: track, sprite: Enemies::Roadrunner, attributes: level.except(:tiles))
          args.state.enemies.roadrunners << entity
        end
      when "Hawk"
        args.state.enemies.hawks ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track(loops: level[:loop] == '0')
          entity = TrackingEntity.new(track: track, sprite: Enemies::Hawk, attributes: level.except(:tiles))
          args.state.enemies.hawks << entity
        end
      when "Owl"
        args.state.enemies.owls ||= []
        level_data.each do |level|
          track = TrackBuilder.new(args, level[:tiles]).build_track(loops: level[:loop] == '0')
          entity = TrackingEntity.new(track: track, sprite: Enemies::Owl, attributes: level.except(:tiles))
          args.state.enemies.owls << entity
        end
      end
    end
  end

  def tick(args)
    sprites = []

    [
      args.state.enemies.roadrunners,
      args.state.enemies.hawks,
      args.state.enemies.owls
    ].each do |enemy_group|
      enemy_group.each do |entity|
        entity.tick(args)
        sprites << entity.sprite unless entity.offscreen

        entity.current_track.show_debug(args)
        entity.show_debug(args)
      end
    end

    args.outputs.sprites << sprites
  end
end