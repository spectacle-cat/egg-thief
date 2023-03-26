class TrackLoop
  attr_reader :steps, :last_index
  attr_accessor :previous_step, :current_step, :next_step

  def initialize(steps)
    @steps = steps
    reindex!

    @current_step = steps[0]
    @previous_step = find_previous_step
    @next_step = find_next_step
  end

  def update!
    increment_step
  end

  def on_last_step?
    false
  end

  def increment_step
    self.previous_step = current_step
    self.current_step = next_step
    self.next_step = find_next_step
  end

  def find_next_step
    lookup_step_after(current_step)
  end

  def find_previous_step
    lookup_step_before(current_step)
  end

  def lookup_step_after(step)
    i = step[:index]
    if i == last_index
      steps[0]
    else
      steps[i + 1]
    end
  end

  def lookup_step_before(step)
    i = step[:index]
    if i == last_index
      steps[0]
    else
      steps[i - 1]
    end
  end

  # make the index zero based
  def reindex!
    index = 0
    steps.flatten.each do |step|
      step[:index] = index
      index += 1
    end

    @last_index = index - 1
  end

  def show_debug(args)
    steps.each do |step|
      stepb = lookup_step_after(step)
      args.outputs.debug <<
      if step[:corner_angle] == true
        [step[:x], step[:y], stepb[:x], stepb[:y], 0, 150, 250].line
      else
        [step[:x], step[:y], stepb[:x], stepb[:y], 200, 200, 0].line
      end
    end
    # args.outputs.debug << [
    #   current_step[:x], current_step[:y],
    #   next_step[:x], next_step[:y], 0, 200, 0
    # ].line
  end
end