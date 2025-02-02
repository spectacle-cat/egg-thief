class Sprite
  attr_accessor :x, :y, :w, :h, :path, :angle, :a, :r, :g, :b,
                :source_x, :source_y, :source_w, :source_h,
                :tile_x, :tile_y, :tile_w, :tile_h,
                :flip_horizontally, :flip_vertically,
                :anchor_x, :anchor_y,
                :angle_anchor_x, :angle_anchor_y, :blendmode_enum,
                :scale_quality_enum

  def primitive_marker
    :sprite
  end
end
