require 'app/collisions/scorpion_tile_triggers.rb'

class Collisions
  attr_reader :player_collider
  attr_accessor :args

  def initialize(args, player_collider)
    @args = args
    @player_collider = player_collider
  end

  def run!
    check_finish
    check_nests
    check_enemy_triggers
  end

  def check_finish
    if args.state.interactables.finish_rect.intersect_rect?(player_collider)
      args.state.exit_level = true
    end
  end

  def check_nests
    args.state.nests.delete_if do |nest|
      hit = nest[:collision_box].intersect_rect?(player_collider)

      if hit
        args.state.collected_nests << nest
        args.state.empty_nests << nest
      end

      hit
    end
  end

  def check_enemy_triggers
    ScorpionTileTriggers.run(args, player_collider)
  end
end