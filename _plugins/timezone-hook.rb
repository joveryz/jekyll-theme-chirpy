# frozen_string_literal: true
#
# Interpret a post's naive `date` in its front matter `timezone` (IANA name),
# e.g. `timezone: Asia/Shanghai`, so the emitted timestamp is the correct
# instant (DST-aware) no matter what timezone the build machine is in.

require 'tzinfo'

# Runs at :site, :post_read (after front matter is parsed) — at :post_init the
# post's `date` is still nil, so the hook must fire post-read.
Jekyll::Hooks.register :site, :post_read do |site|
  site.posts.docs.each do |post|
    tz_name = post.data['timezone'].to_s.strip
    next if tz_name.empty?

    d = post.data['date']
    next if d.nil?

    tz = TZInfo::Timezone.get(tz_name)
    wall_clock = Time.utc(d.year, d.month, d.day, d.hour, d.min, d.sec)
    # local_to_utc reads the tz database directly (no global ENV / libc cache),
    # picking the first period for ambiguous DST fall-back times.
    post.data['date'] = tz.local_to_utc(wall_clock) { |periods| periods.first }
  end
end
