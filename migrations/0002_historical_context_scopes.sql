-- Upgrade a legacy candidate index. Run only when its scope constraint is old.
CREATE TABLE hi_record_series_context_scopes (
 snapshot_version TEXT NOT NULL, record_id TEXT NOT NULL, series_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('subject','area_context','asking_benchmark','community_context','published_reference')),
 identity_verified INTEGER NOT NULL CHECK(identity_verified IN (0,1)),
 PRIMARY KEY(snapshot_version,record_id,series_id),
 FOREIGN KEY(snapshot_version,record_id) REFERENCES hi_records(snapshot_version,record_id),
 FOREIGN KEY(snapshot_version,series_id) REFERENCES hi_series(snapshot_version,series_id)
);
INSERT INTO hi_record_series_context_scopes SELECT * FROM hi_record_series;
DROP TABLE hi_record_series;
ALTER TABLE hi_record_series_context_scopes RENAME TO hi_record_series;
CREATE TRIGGER hi_record_series_immutable_update BEFORE UPDATE ON hi_record_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER hi_record_series_immutable_delete BEFORE DELETE ON hi_record_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
