#!/usr/bin/env ruby
# frozen_string_literal: true

#
# List all .ai_logs files in the project root, sorted by modification date.
#

require 'pathname'
require 'time'

# Find the project root by looking for .git directory or .ai_logs directory.
# Start from current directory and walk up.
def find_project_root
  current = Pathname.pwd

  # Walk up the directory tree
  current.ascend do |parent|
    return parent if parent.join('.git').exist? || parent.join('.ai_logs').exist?
  end

  # If no git or .ai_logs found, use current directory
  current
end

# List all markdown files in .ai_logs directory and subdirectories.
# Supports both flat structure (legacy) and nested YYYY/MM/ structure.
# Returns array of hashes: [{path: Pathname, mtime: Time}, ...]
def list_ai_logs(project_root)
  ai_logs_dir = project_root.join('.ai_logs')

  return [] unless ai_logs_dir.exist?

  # Search recursively for all .md files
  # Supports both:
  #   - Legacy: .ai_logs/*.md
  #   - New: .ai_logs/YYYY/MM/*.md
  files = Dir.glob(ai_logs_dir.join('**', '*.md')).map do |file_path|
    path = Pathname.new(file_path)
    next unless path.file?

    {
      path: path,
      mtime: path.mtime
    }
  end.compact

  # Sort by modification time (newest first)
  files.sort_by { |f| f[:mtime] }.reverse
end

# Format time as human-readable date/time
def format_time(time)
  time.strftime('%Y-%m-%d %H:%M')
end

def main
  project_root = find_project_root
  files = list_ai_logs(project_root)

  if files.empty?
    puts "No .ai_logs files found in #{project_root.join('.ai_logs')}"
    puts "\nCreate .ai_logs directory with:"
    puts "  mkdir -p #{project_root.join('.ai_logs')}"
    return
  end

  puts "📁 .ai_logs files in #{project_root}:\n\n"

  files.each do |file|
    # Get relative path from project root
    rel_path = file[:path].relative_path_from(project_root)
    time_str = format_time(file[:mtime])
    puts "  #{rel_path} (modified: #{time_str})"
  end

  puts "\n📊 Total: #{files.size} file(s)"
end

main if __FILE__ == $PROGRAM_NAME
