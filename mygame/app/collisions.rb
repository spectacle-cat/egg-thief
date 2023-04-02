require 'app/game.rb'
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
    check_enemies
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

  def check_enemies
    args.state.scorpions.each do |scorpion|
      hit = Enemies::Scorpion.hit_box(args, scorpion).intersect_rect?(player_collider)
      if hit
        Game.restart_level!(args)
        break
      end
    end

    check_fov_collisions(args.state.enemies.roadrunners)
    check_fov_collisions(args.state.enemies.hawks)
    check_fov_collisions(args.state.enemies.owls)
  end

  def point_inside_rect?(point, rect)
    (point.x - rect.x) <= rect.w && (point.y - rect.y) <= rect.h
  end

  def check_fov_collisions(enemies)
    enemies.each do |enemy|
      point = enemy.sprite.origin_point
      standing_tile = args.state.tiles.find do |tile|
        point_inside_rect?(point, tile)
      end.dup

      next unless standing_tile

      hit = standing_tile.intersect_rect?(player_collider)
      if hit
        Game.restart_level!(args)
        return
      end

      fov = enemy.sprite.fov
      _, fov_direction = fov.shift

      fov_tiles = fov.map do |(col_offset, row_offset)|
        board_row = standing_tile[:row] + row_offset
        board_col = standing_tile[:column] + col_offset

        tile = args.state.tiles.find { |tile| tile[:row] == board_row && tile[:column] == board_col }.clone

        if tile && !tile.hide_from_enemy_fov
          tile.merge(fov_col: col_offset, fov_row: row_offset)
        end
      end

      fov_tiles.compact!
      fov_tiles << standing_tile.merge(fov_col: 0, fov_row: 0)

      fov_tiles = fov_tiles.select do |tile|
        col = tile[:fov_col]
        row = tile[:fov_row]

        args.outputs.debug << {
          x: tile.x + 35,
          y: tile.y + 50,
          text: "(#{row},#{col})",
          r: 250, g: 250, b: 250, a: 200
        }.label if tile && args.state.debug

        in_sight = Fov.new(fov_tiles: fov_tiles, facing: fov_direction, base_width: 3).in_sight?(fov_col: col, fov_row: row)

        if in_sight
          args.outputs.debug << tile.merge(g: 100, b: 200, a: 50).solid if args.state.debug
        else
          args.outputs.debug << tile.merge(r: 200, g: 20, b: 20, a: 50).solid if args.state.debug
        end

        in_sight
      end

      sighted = fov_tiles.find { |tile| tile.intersect_rect?(player_collider) }

      if sighted
        enemy.sighted_enemy!
      else
        enemy.idle_walk
      end
    end
  end
end