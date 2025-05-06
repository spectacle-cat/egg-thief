module Enemies
  extend self

  def setup(args)
    enemies = args.state.level_data.except("Tiles")

    args.state.enemies.roadrunners ||= []
    args.state.enemies.hawks ||= []
    args.state.enemies.owls ||= []

    enemies.each do |(enemy_type, level_data)|
      case enemy_type
      when "Roadrunner"
        level_data.each do |level|
          args.state.enemies.roadrunners << tracking_entity(args, level, Enemies::Roadrunner)
        end
      when "Hawk"
        level_data.each do |level|
          args.state.enemies.hawks << tracking_entity(args, level, Enemies::Hawk)
        end
      when "Owl"
        level_data.each do |level|
          args.state.enemies.owls << tracking_entity(args, level, Enemies::Owl)
        end
      end
    end
  end

  def tracking_entity(args, level, sprite)
    track = TrackBuilder
      .new(args, level[:tiles])
      .build_track(loops: level["loops"] != "false")

    TrackingEntity
      .new(track: track, sprite: sprite, attributes: level.except(:tiles))
  end

  def tick(args, paused: false)
    sprites = []

    [
      args.state.enemies.roadrunners,
      args.state.enemies.hawks,
      args.state.enemies.owls
    ].each do |enemy_group|
      enemy_group.each do |entity|
        entity.tick(args) unless paused
        entity.sprite.tick(args.tick_count, entity.speed) if entity.sprite.is_a?(Enemies::Roadrunner)
        sprites << entity.sprite unless entity.offscreen

        entity.current_track.show_debug(args)
        entity.show_debug(args)
      end
    end

    args.outputs.sprites << sprites
  end
end