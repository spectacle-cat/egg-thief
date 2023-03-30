class SingleTrack < TrackLoop
  attr_reader :steps, :last_index
  attr_accessor :previous_step, :current_step, :next_step

  def initialize(steps)
    @steps = steps.dup
    reindex!
    offset_points_to_center

    @current_step = @steps[0]
    @previous_step = find_previous_step
    @next_step = find_next_step
  end

  def reset!
    self.current_step = @steps[0]
    self.previous_step = find_previous_step
    self.next_step = find_next_step
  end

  def update!
    increment_step
  end

  def increment_step
    self.previous_step = current_step
    self.current_step = next_step
    self.next_step = find_next_step
  end

  def on_last_step?
    find_next_step == nil
  end

  def on_first_step?
    current_step[:index] == 0
  end

  def find_next_step
    lookup_step_after(current_step)
  end

  def find_previous_step
    return nil if on_first_step?

    lookup_step_before(current_step)
  end

  def lookup_step_after(step)
    return if step.nil?
    i = step[:index]
    if i == last_index
      nil
    else
      steps[i + 1]
    end
  end

  def lookup_step_before(step)
    i = step[:index]
    if i == 0
      nil
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
    # args.outputs.labels << [50, 50, "current_step: #{current_step}"]
    # args.outputs.labels << [50, 75, "next_step: #{next_step}"]
    steps.each do |step|
      stepb = lookup_step_after(step)
      next unless stepb

      args.outputs.debug << [step[:x] + 50, step[:y] + 50, stepb[:x] + 50, stepb[:y] + 50, 200, 200, 0].line
    end

    # if next_step
    #   args.outputs.debug << [
    #     current_step[:x] + 50, current_step[:y] + 50,
    #     next_step[:x] + 50, next_step[:y] + 50, 0, 200, 0
    #   ].line
    # end
  end

  def to_s
    serialize
  end

  def serialize
    {
      loops: false,
      previous_step: previous_step,
      current_step: current_step,
      next_step: next_step,
    }
  end

  private

  def offset_points_to_center
    steps.each do |step|
      step[:x] += 50
      step[:y] += 50
    end
  end
end