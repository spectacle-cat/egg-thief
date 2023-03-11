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
      # args.outputs.debug << scorpion.sprite.border

      hit = Scorpion.hit_box(args, scorpion).intersect_rect?(player_collider)
      if hit
        Game.restart_level!(args)
        break
      end
    end

    args.state.enemies.roadrunners.each.with_index do |roadrunner, index|
      point = roadrunner.sprite.origin_point
      standing_tile = args.state.tiles.find do |tile|
        point_inside_rect?(point, tile)
      end

      fov = roadrunner.sprite.fov
      _, fov_direction = fov.shift

      fov_tiles = fov.map do |(col_offset, row_offset)|
        board_row = standing_tile[:row] + row_offset
        board_col = standing_tile[:column] + col_offset

        tile = args.state.tiles.find { |tile| tile[:row] == board_row && tile[:column] == board_col }

        if tile && !tile.hide_from_enemy_fov
          tile.merge(fov_col: col_offset, fov_row: row_offset)
        end
      end

      fov_tiles.compact!

      fov_tiles = fov_tiles.select do |tile|
        col = tile[:fov_col]
        row = tile[:fov_row]

        args.outputs.debug << {
          x: tile.x + 35,
          y: tile.y + 50,
          text: "(#{row},#{col})",
          r: 250, g: 250, b: 250, a: 200
        }.label if tile

        insight = false

        original_col = col
        original_row = row

        while col != 0 && row != 0
          col = col - col.sign unless col = 0
          row = row - row.sign unless row = 0

          if col == 0 && row == 0
            insight = true
            break
          end

          break unless fov_tiles.find { |ftile| ftile[:fov_col] == col && ftile[:fov_row] == row }
        end

        col = original_col
        row = original_row

        unless insight
          original_col = col
          while col != 0
            col = col - col.sign unless col = 0

            if col == 0 && row == 0
              insight = true
              break
            end

            break unless fov_tiles.find { |ftile| ftile[:fov_col] == col && ftile[:fov_row] == row }
          end
          col = original_col
        end

        unless insight
          original_row = row
          while row != 0
            row = row - row.sign unless row = 0

            if col == 0 && row == 0
              insight = true
              break
            end

            break unless fov_tiles.find { |ftile| ftile[:fov_col] == col && ftile[:fov_row] == row }
          end
          row = original_row
        end

        if insight
          args.outputs.debug << tile.merge(g: 100, b: 200, a: 50).solid
        else
          args.outputs.debug << tile.merge(r: 200, g: 20, b: 20, a: 50).solid
        end

        insight
      end

      fov_tiles << standing_tile

      hit = fov_tiles.any_intersect_rect?(player_collider)

      # fov_tiles.each { |tile| args.outputs.debug << tile.merge(g: 100, b: 200, a: 50).solid }
      args.outputs.debug << standing_tile.merge(a: 50).solid
      args.outputs.debug << {
        x: standing_tile.x + 25,
        y: standing_tile.y + 50,
        text: fov_direction,
        r: 250, g: 250, b: 250, a: 200
      }.label

      Game.restart_level!(args) if hit
    end
  end

  def point_inside_rect?(point, rect)
    (point.x - rect.x) <= rect.w && (point.y - rect.y) <= rect.h
  end
end