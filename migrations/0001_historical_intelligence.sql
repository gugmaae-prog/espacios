-- Candidate-only append-only indexes. Apply only to an isolated candidate D1.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS hi_snapshots (
 snapshot_version TEXT PRIMARY KEY, as_of TEXT NOT NULL, record_count INTEGER NOT NULL,
 manifest_json TEXT NOT NULL, root_sha256 TEXT NOT NULL,
 publication_state TEXT NOT NULL DEFAULT 'staged' CHECK(publication_state IN ('staged','complete'))
);
CREATE TABLE IF NOT EXISTS hi_records (
 snapshot_version TEXT NOT NULL, record_id TEXT NOT NULL, record_type TEXT NOT NULL,
 name TEXT NOT NULL, emirate TEXT NOT NULL, record_json TEXT NOT NULL,
 PRIMARY KEY(snapshot_version,record_id), FOREIGN KEY(snapshot_version) REFERENCES hi_snapshots(snapshot_version)
);
CREATE INDEX IF NOT EXISTS hi_records_emirate ON hi_records(snapshot_version,emirate,record_type);
CREATE TABLE IF NOT EXISTS hi_sources (
 snapshot_version TEXT NOT NULL, source_id TEXT NOT NULL, url TEXT NOT NULL, source_json TEXT NOT NULL,
 PRIMARY KEY(snapshot_version,source_id), FOREIGN KEY(snapshot_version) REFERENCES hi_snapshots(snapshot_version)
);
CREATE TABLE IF NOT EXISTS hi_events (
 snapshot_version TEXT NOT NULL, event_id TEXT NOT NULL, event_json TEXT NOT NULL,
 PRIMARY KEY(snapshot_version,event_id), FOREIGN KEY(snapshot_version) REFERENCES hi_snapshots(snapshot_version)
);
CREATE TABLE IF NOT EXISTS hi_exposures (
 snapshot_version TEXT NOT NULL, exposure_id TEXT NOT NULL, event_id TEXT NOT NULL,
 record_id TEXT NOT NULL, scope TEXT NOT NULL, verified INTEGER NOT NULL CHECK(verified IN (0,1)), exposure_json TEXT NOT NULL,
 PRIMARY KEY(snapshot_version,exposure_id),
 FOREIGN KEY(snapshot_version,event_id) REFERENCES hi_events(snapshot_version,event_id),
 FOREIGN KEY(snapshot_version,record_id) REFERENCES hi_records(snapshot_version,record_id)
);
CREATE INDEX IF NOT EXISTS hi_exposures_record ON hi_exposures(snapshot_version,record_id,event_id);
CREATE TABLE IF NOT EXISTS hi_series (
 snapshot_version TEXT NOT NULL, series_id TEXT NOT NULL, source_id TEXT NOT NULL, series_json TEXT NOT NULL,
 PRIMARY KEY(snapshot_version,series_id), FOREIGN KEY(snapshot_version,source_id) REFERENCES hi_sources(snapshot_version,source_id)
);
CREATE TABLE IF NOT EXISTS hi_record_series (
 snapshot_version TEXT NOT NULL, record_id TEXT NOT NULL, series_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('subject','area_context','asking_benchmark')), identity_verified INTEGER NOT NULL CHECK(identity_verified IN (0,1)),
 PRIMARY KEY(snapshot_version,record_id,series_id),
 FOREIGN KEY(snapshot_version,record_id) REFERENCES hi_records(snapshot_version,record_id),
 FOREIGN KEY(snapshot_version,series_id) REFERENCES hi_series(snapshot_version,series_id)
);

-- Evidence rows are immutable within a snapshot version. Revisions use new versions.
CREATE TRIGGER IF NOT EXISTS hi_records_immutable_update BEFORE UPDATE ON hi_records BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_records_immutable_delete BEFORE DELETE ON hi_records BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_sources_immutable_update BEFORE UPDATE ON hi_sources BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_sources_immutable_delete BEFORE DELETE ON hi_sources BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_events_immutable_update BEFORE UPDATE ON hi_events BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_events_immutable_delete BEFORE DELETE ON hi_events BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_exposures_immutable_update BEFORE UPDATE ON hi_exposures BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_exposures_immutable_delete BEFORE DELETE ON hi_exposures BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_series_immutable_update BEFORE UPDATE ON hi_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_series_immutable_delete BEFORE DELETE ON hi_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_record_series_immutable_update BEFORE UPDATE ON hi_record_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_record_series_immutable_delete BEFORE DELETE ON hi_record_series BEGIN SELECT RAISE(ABORT, 'Immutable historical evidence; create a new snapshot version'); END;
CREATE TRIGGER IF NOT EXISTS hi_snapshots_immutable_delete BEFORE DELETE ON hi_snapshots BEGIN SELECT RAISE(ABORT, 'Immutable snapshot'); END;
CREATE TRIGGER IF NOT EXISTS hi_snapshots_state_only BEFORE UPDATE ON hi_snapshots
WHEN NEW.snapshot_version IS NOT OLD.snapshot_version OR NEW.as_of IS NOT OLD.as_of OR NEW.record_count IS NOT OLD.record_count OR NEW.manifest_json IS NOT OLD.manifest_json OR NEW.root_sha256 IS NOT OLD.root_sha256 OR OLD.publication_state = 'complete' AND NEW.publication_state != 'complete'
BEGIN SELECT RAISE(ABORT, 'Only snapshot publication completion may change'); END;
