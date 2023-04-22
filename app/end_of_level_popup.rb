class EndOfLevelPopup
  attr_reader :x, :y, :width, :height, :eggs_collected, :time_taken
  attr_accessor :animation_started_at

  def initialize(eggs_collected, time_taken)
    @x = 100
    @y = 100
    @width = 1114 / 2
    @height = 930 / 2
    @eggs_collected = eggs_collected
    @time_taken = time_taken
    @animation_started_at = nil
  end

  def render(args)
    font_path = 'fonts/caroni/Caroni-Regular.otf'
    labels = []
    centered_x = (args.grid.w / 2 - width / 2)
    centered_y = (args.grid.h / 2 - height / 2)
    modified_y = animation_offset(args, centered_y)
    number_of_level_eggs = args.state.nests.count + args.state.empty_nests.count
    can_continue = number_of_level_eggs == eggs_collected

    args.outputs.primitives << {
      x: centered_x,
      y: modified_y,
      w: width,
      h: height,
      path: 'sprites/EndLevel_windowBOX.png'
    }.sprite!

    labels << {
      x: centered_x + width / 2,
      y: modified_y + height * 0.9,
      text: "LEVEL #{args.state.level} COMPLETE",
      size_enum: 25,
      alignment_enum: 1, # 0 for left, 1 for center, 2 for right alignment
      valign_enum: 0, # 0 for top, 1 for middle, 2 for bottom alignment
      font: font_path,
      r: 52, g: 43, b: 14,
    }
    labels << {
      x: centered_x + width / 2,
      y: modified_y + height * 0.72,
      text: "#{@eggs_collected}/#{args.state.nests.count + args.state.empty_nests.count} EGGS",
      size_enum: 15,
      alignment_enum: 1, # 0 for left, 1 for center, 2 for right alignment
      valign_enum: 0, # 0 for top, 1 for middle, 2 for bottom alignment
      r: 52, g: 43, b: 14,
    }
    labels << {
      x: centered_x + width / 2,
      y: modified_y + height * 0.52,
      text: "#{@time_taken}",
      size_enum: 40,
      alignment_enum: 1, # 0 for left, 1 for center, 2 for right alignment
      valign_enum: 0, # 0 for top, 1 for middle, 2 for bottom alignment
      r: 52, g: 43, b: 14,
    }

    labels << retry_label = {
      x: centered_x + width / 4,
      y: modified_y + height * 0.2,
      text: "Retry",
      alignment_enum: 0,
      r: 52, g: 43, b: 14,
    }
    labels << continue_label = {
      x: centered_x + width / 2 + width / 4,
      y: modified_y + height * 0.2,
      text: "Continue",
      alignment_enum: 2,
      r: 52, g: 43, b: 14,
      a: can_continue ? 255 : 100,
    }
    labels << {
      x: centered_x + width / 2 + width / 2.8,
      y: modified_y + height * 0.11,
      text: "Find all the eggs!",
      alignment_enum: 2,
      r: 52, g: 43, b: 14,
    } unless can_continue

    retry_btn = retry_label.merge(w: 100, h: 50, x: retry_label[:x] - 25, y: retry_label[:y] - 35)
    continue_btn = continue_label.merge(
      w: 100,
      h: 50,
      x: continue_label[:x] - 90,
      y: continue_label[:y] - 35,
    )

    args.outputs.labels << labels
    args.outputs.borders << [retry_btn, continue_btn]

    Game.restart_level!(args) if button_clicked?(args, retry_btn)

    args.state.exit_level = true if can_continue && button_clicked?(args, continue_btn)
  end

  def button_clicked?(args, button)
    mouse_x = args.inputs.mouse.x
    mouse_y = args.inputs.mouse.y
    click = args.inputs.mouse.click

    x = button[:x]
    y = button[:y]

    click &&
      mouse_x.between?(x, x + button[:w]) &&
      mouse_y.between?(y, y + button[:h])
  end

  def animation_offset(args, value, duration: 30)
    self.animation_started_at = args.tick_count if animation_started_at.nil?

    progress = args.easing.ease animation_started_at, args.tick_count, duration, :flip, :quad, :flip

    value * progress
  end
end