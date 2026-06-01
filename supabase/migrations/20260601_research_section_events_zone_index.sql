create index if not exists idx_research_section_events_zone_created
  on research_section_events (artifact_id, zone, created_at desc);
