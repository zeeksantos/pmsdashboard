-- New employment type: project-based staff (hired for a project, usually with an end date).
alter type public.employment_type add value if not exists 'PROJECT_BASED';
