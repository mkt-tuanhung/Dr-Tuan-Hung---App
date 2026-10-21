truncate mw_workspaces, mw_reviewers, notifications cascade;
update clinic_settings set mw_enabled = false;
