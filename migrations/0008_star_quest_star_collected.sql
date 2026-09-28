-- Migration 0008: track which given stars a kid has dragged into their jar
-- in Kid Mode. NULL = still pending (shown below the jar to drag in);
-- goal/reward progress is unaffected by this — it still counts every given
-- star immediately, same as before. This is purely a Kid Mode engagement
-- layer on top.

ALTER TABLE sq_star_entry ADD COLUMN collected_at DATETIME;
