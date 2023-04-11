module ScorpionTileTriggers
  extend self

  def run(args, player_collider)
    args.state.scorpions.each do |scorpion|
      tiles_hit = trigger_tile_candidates(args, scorpion).select do |tile|
        tile.intersect_rect?(player_collider)
      end.each do |tile|
        # args.outputs.debug << [tile[:x], tile[:y], 100, 100, 255].border

        unless Enemies::Scorpion.animating?(args, scorpion)
          scorpion[:attack_started_at] = args.tick_count
          scorpion[:attack_direction] = tile[:direction]
        end
      end
    end
  end

  def trigger_tile_candidates(args, scorpion)
    tile_candidates = [
      tile_above(scorpion),
      tile_below(scorpion),
      tile_right(scorpion),
      tile_left(scorpion),
    ]

    tile_candidates.map do |tile|
      tile.merge({w: TileBoard::TILE_SIZE, h: TileBoard::TILE_SIZE})
    end.reject do |tile|
      args.state.boulders.any_intersect_rect?(tile)
    end
  end

  def tile_above(scorpion)
    { x: scorpion[:x], y: scorpion[:y] + TileBoard::TILE_SIZE, direction: :up }
  end

  def tile_below(scorpion)
    { x: scorpion[:x], y: scorpion[:y] - TileBoard::TILE_SIZE, direction: :down }
  end

  def tile_left(scorpion)
    { x: scorpion[:x] - TileBoard::TILE_SIZE, y: scorpion[:y], direction: :left }
  end

  def tile_right(scorpion)
    { x: scorpion[:x] + TileBoard::TILE_SIZE, y: scorpion[:y], direction: :right }
  end
end