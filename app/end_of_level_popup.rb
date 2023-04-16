class EndOfLevelPopup
  attr_accessor :x, :y, :width, :height, :eggs_collected, :time_taken

  def initialize(eggs_collected, time_taken)
    @x = 100
    @y = 100
    @width = 500
    @height = 200
    @eggs_collected = eggs_collected
    @time_taken = time_taken
  end

  def render(outputs)
    # Draw the background and text for the popup
    outputs.solids << [x, y, width, height, 128, 128, 128]
    outputs.labels << [x + 10, y + 10, "Eggs collected: #{@eggs_collected}"]
    outputs.labels << [x + 10, y + 30, "Time taken: #{@time_taken}"]

    # Draw the retry and continue buttons
    # Add code to draw the buttons and handle input for clicking on them
  end

  # Add any other methods needed for your popup
end