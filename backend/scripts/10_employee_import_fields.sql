-- Add employee_code and employment_type to profiles for API import
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type TEXT;
COMMENT ON COLUMN public.profiles.employee_code IS 'Employee code from HRMS/API import';
COMMENT ON COLUMN public.profiles.employment_type IS 'Employment type: full_time, part_time, contract';

-- Additional HRMS-import fields stored on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS external_role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS external_sub_role TEXT;
