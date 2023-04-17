class EndOfLevelPopup
  attr_accessor :x, :y, :width, :height, :eggs_collected, :time_taken

  BUTTON_WIDTH = 100
  BUTTON_HEIGHT = 50
  BUTTONS = {
    retry: {
      x: 200, y: 300, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, text: "Retry"
    },
    continue: {
      x: 310, y: 300, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, text: "Continue"
    }
  }

  def initialize(eggs_collected, time_taken)
    @x = 100
    @y = 100
    @width = 500
    @height = 200
    @eggs_collected = eggs_collected
    @time_taken = time_taken
  end

  def render(args)
    # Draw the background and text for the popup
    args.outputs.solids << [x, y, width, height, 128, 128, 128]
    args.outputs.labels << [x + 10, y + 10, "Eggs collected: #{@eggs_collected}"]
    args.outputs.labels << [x + 10, y + 30, "Time taken: #{@time_taken}"]

    BUTTONS.each do |(name, button)|
      args.outputs.borders << [button[:x], button[:y], button[:width], button[:height]]
      args.outputs.labels << [button[:x] + button[:width] / 2, button[:y] + button[:height] / 2, button[:text], 0, 1]

      if button_clicked?(args, name)
        handle_button_click(args, name)
      end
    end

    # Draw the retry and continue buttons
    # Add code to draw the buttons and handle input for clicking on them
  end

  def button_clicked?(args, button_name)
    button = BUTTONS[button_name]

    mouse_x = args.inputs.mouse.x
    mouse_y = args.inputs.mouse.y
    click = args.inputs.mouse.click

    x = button[:x]
    y = button[:y]

    click &&
      mouse_x.between?(x, x + BUTTON_WIDTH) &&
      mouse_y.between?(y, y + BUTTON_HEIGHT)
  end

  def handle_button_click(args, button_name)
    case button_name
    when :retry
      Game.restart_level!(args)
    when :continue
      args.state.exit_level = true
    end
  end
end